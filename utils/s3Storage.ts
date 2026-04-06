import { S3Settings } from '../types';

type SignedRequest = {
  url: URL;
  headers: Record<string, string>;
};

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const sha256Hex = async (data: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return toHex(digest);
};

const hmacSha256 = async (key: ArrayBuffer | Uint8Array | string, data: string): Promise<ArrayBuffer> => {
  const rawKey = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
};

const formatAmzDate = (date: Date) => {
  const iso = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const basic = iso.replace(/[-:]/g, '');
  return {
    amzDate: basic.replace('Z', 'Z'),
    dateStamp: basic.slice(0, 8)
  };
};

const encodePath = (path: string) => {
  if (!path) return '/';
  return path
    .split('/')
    .map(segment => {
      const decoded = (() => {
        try {
          return decodeURIComponent(segment);
        } catch (error) {
          return segment;
        }
      })();
      return encodeURIComponent(decoded);
    })
    .join('/')
    .replace(/%2F/g, '/');
};

const buildCanonicalQuery = (url: URL) => {
  const params = Array.from(url.searchParams.entries())
    .map(([key, value]) => [encodeURIComponent(key), encodeURIComponent(value)] as const)
    .sort((a, b) => a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0]));
  return params.map(([key, value]) => `${key}=${value}`).join('&');
};

const signS3Request = async (input: {
  method: string;
  url: URL;
  settings: S3Settings;
  extraHeaders?: Record<string, string>;
  unsignedPayload?: boolean;
}) => {
  const { method, url, settings, extraHeaders = {}, unsignedPayload = false } = input;
  if (!crypto?.subtle) {
    throw new Error('Web Crypto is not available for S3 signing.');
  }

  const now = new Date();
  const { amzDate, dateStamp } = formatAmzDate(now);
  const payloadHash = unsignedPayload ? 'UNSIGNED-PAYLOAD' : await sha256Hex('');

  const headerMap = new Map<string, string>();
  headerMap.set('host', url.host);
  headerMap.set('x-amz-date', amzDate);
  headerMap.set('x-amz-content-sha256', payloadHash);

  Object.entries(extraHeaders).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    headerMap.set(key.toLowerCase(), String(value).trim());
  });

  const sortedHeaders = Array.from(headerMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  const canonicalHeaders = sortedHeaders.map(([key, value]) => `${key}:${value}\n`).join('');
  const signedHeaders = sortedHeaders.map(([key]) => key).join(';');

  const canonicalRequest = [
    method.toUpperCase(),
    encodePath(url.pathname),
    buildCanonicalQuery(url),
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const credentialScope = `${dateStamp}/${settings.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join('\n');

  const kDate = await hmacSha256(`AWS4${settings.secretKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, settings.region);
  const kService = await hmacSha256(kRegion, 's3');
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${settings.accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ');

  const headers: Record<string, string> = {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization: authorization
  };

  Object.entries(extraHeaders).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    headers[key] = String(value);
  });

  return { headers };
};

export const isS3SettingsReady = (settings?: S3Settings | null): settings is S3Settings => {
  return !!settings
    && !!settings.url?.trim()
    && !!settings.accessKey?.trim()
    && !!settings.secretKey?.trim()
    && !!settings.region?.trim();
};

/**
 * Check if the S3 URL is a Supabase S3-compatible endpoint.
 * Supabase S3 URLs end with /storage/v1/s3
 */
export const isSupabaseS3Endpoint = (url: string): boolean => {
  const normalized = normalizeS3BaseUrl(url).toLowerCase();
  return normalized.includes('/storage/v1/s3');
};

/**
 * Extract bucket name from Supabase S3 URL path.
 * Supabase S3 uses path-style URLs: /storage/v1/s3/{bucket}/{key}
 */
export const extractBucketFromSupabaseS3Url = (url: string): string => {
  const normalized = normalizeS3BaseUrl(url);
  // URL format: http://host/storage/v1/s3 or http://host/storage/v1/s3/bucket-name
  const match = normalized.match(/\/storage\/v1\/s3(?:\/([^/]+))?/i);
  return match?.[1] || '';
};

/**
 * Build the correct Supabase S3 API URL.
 * Supabase S3 expects: http://host/storage/v1/s3/{bucket}/{key}
 * 
 * If the base URL already contains the bucket, just append the key.
 * If not, we assume 'patient_files' as the default bucket.
 */
export const buildSupabaseS3Url = (baseUrl: string, key: string): string => {
  const normalized = normalizeS3BaseUrl(baseUrl);
  
  // If URL already has bucket path (e.g., .../s3/patient_files), just append key
  if (normalized.match(/\/storage\/v1\/s3\/[^/]+$/i)) {
    return key ? `${normalized}/${key}` : normalized;
  }
  
  // If URL is just /storage/v1/s3, add default bucket
  const bucket = extractBucketFromSupabaseS3Url(baseUrl) || 'patient_files';
  
  if (key) {
    return `${normalized}/${bucket}/${key}`;
  }
  return `${normalized}/${bucket}`;
};

/**
 * Build Supabase S3 public URL for file access.
 * Format: http://host/storage/v1/object/public/{bucket}/{key}
 */
export const buildSupabaseS3PublicUrl = (baseUrl: string, key: string): string => {
  const normalized = normalizeS3BaseUrl(baseUrl);
  const bucket = extractBucketFromSupabaseS3Url(baseUrl) || 'patient_files';
  
  // Convert base URL to public object URL
  const objectUrl = normalized.replace(/\/storage\/v1\/s3/i, '/storage/v1/object/public');
  return `${objectUrl}/${bucket}/${key}`;
};

export const normalizeS3BaseUrl = (rawUrl: string) => rawUrl.trim().replace(/\/+$/, '');

export const buildS3FileUrl = (baseUrl: string, key: string) => {
  const safeBase = normalizeS3BaseUrl(baseUrl);
  return `${safeBase}/${key}`;
};

export const listS3Objects = async (settings: S3Settings, prefix: string) => {
  const baseUrl = normalizeS3BaseUrl(settings.url);
  
  // For Supabase S3, build URL with bucket in path
  const url = new URL(
    isSupabaseS3Endpoint(baseUrl)
      ? buildSupabaseS3Url(baseUrl, '')  // Returns .../s3/patient_files
      : baseUrl
  );
  
  url.searchParams.set('list-type', '2');
  if (prefix) {
    url.searchParams.set('prefix', prefix);
  }

  const { headers } = await signS3Request({
    method: 'GET',
    url,
    settings
  });

  // DEBUG: Log what we're sending
  if (isSupabaseS3Endpoint(baseUrl)) {
    console.log('[S3 Debug] List request:', {
      url: url.toString(),
      path: url.pathname,
      query: url.search,
      headers: Object.keys(headers)
    });
  }

  const response = await fetch(url.toString(), { method: 'GET', headers });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    
    // More detailed debugging
    if (isSupabaseS3Endpoint(baseUrl)) {
      console.error('========== S3 LIST REQUEST FAILED ==========');
      console.error('URL:', url.toString());
      console.error('Status:', response.status);
      console.error('Status Text:', response.statusText);
      console.error('Response Headers:', Object.fromEntries(response.headers.entries()));
      console.error('Response Body (first 500 chars):', errorText.substring(0, 500));
      console.error('=============================================');
    }
    
    throw new Error(`S3 list failed (${response.status} ${response.statusText}): ${errorText.substring(0, 300)}`);
  }

  const xmlText = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');
  const contents = Array.from(xml.getElementsByTagName('Contents'));
  return contents.map((node) => {
    const key = node.getElementsByTagName('Key')[0]?.textContent || '';
    const size = Number(node.getElementsByTagName('Size')[0]?.textContent || 0);
    const lastModified = node.getElementsByTagName('LastModified')[0]?.textContent || undefined;
    return { key, size, lastModified };
  }).filter(item => item.key);
};

export const deleteS3Object = async (settings: S3Settings, key: string) => {
  const baseUrl = normalizeS3BaseUrl(settings.url);
  
  // Build correct URL based on S3 endpoint type
  const url = new URL(
    isSupabaseS3Endpoint(baseUrl) 
      ? buildSupabaseS3Url(baseUrl, key)
      : buildS3FileUrl(baseUrl, key)
  );

  const { headers } = await signS3Request({
    method: 'DELETE',
    url,
    settings
  });

  const response = await fetch(url.toString(), { method: 'DELETE', headers });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`S3 delete failed (${response.status}): ${errorText.substring(0, 200)}`);
  }
};

export const uploadS3Object = async (
  settings: S3Settings,
  key: string,
  file: File,
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void,
  onChunkComplete?: (chunkSize: number, bytesAccepted: number, bytesTotal: number) => void,
  shouldAbort?: () => boolean
) => {
  const baseUrl = normalizeS3BaseUrl(settings.url);
  
  // Build correct URL based on S3 endpoint type
  const url = new URL(
    isSupabaseS3Endpoint(baseUrl) 
      ? buildSupabaseS3Url(baseUrl, key)
      : buildS3FileUrl(baseUrl, key)
  );

  const { headers } = await signS3Request({
    method: 'PUT',
    url,
    settings,
    extraHeaders: {
      'Content-Type': file.type || 'application/octet-stream'
    },
    unsignedPayload: true
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastLoaded = 0;
    xhr.open('PUT', url.toString(), true);
    Object.entries(headers).forEach(([keyName, value]) => {
      xhr.setRequestHeader(keyName, value);
    });
    xhr.upload.onprogress = (event) => {
      if (shouldAbort && shouldAbort()) {
        xhr.abort();
        reject(new Error('Storage settings changed during upload. Please retry.'));
        return;
      }
      if (!event.lengthComputable) return;
      if (onProgress) {
        onProgress(event.loaded, event.total);
      }
      if (onChunkComplete && event.loaded > lastLoaded) {
        const chunkSize = event.loaded - lastLoaded;
        lastLoaded = event.loaded;
        onChunkComplete(chunkSize, event.loaded, event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('S3 upload failed due to a network error.'));
    if (shouldAbort && shouldAbort()) {
      xhr.abort();
      reject(new Error('Storage settings changed during upload. Please retry.'));
      return;
    }
    xhr.send(file);
  });
};
