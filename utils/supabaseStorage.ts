import { SupabaseStorageSettings } from '../types';

/**
 * Supabase Storage REST API utilities
 * Uses Supabase Storage API directly - no AWS Signature V4 needed!
 * This is more reliable than S3-compatible API for Supabase Storage.
 */

/**
 * Check if Supabase Storage settings are ready
 */
export const isSupabaseStorageReady = (
  settings?: SupabaseStorageSettings | null
): settings is SupabaseStorageSettings => {
  return (
    !!settings &&
    !!settings.storageUrl?.trim() &&
    !!settings.anonKey?.trim() &&
    !!settings.bucket?.trim()
  );
};

/**
 * Normalize Supabase Storage base URL
 */
export const normalizeSupabaseStorageUrl = (rawUrl: string) =>
  rawUrl.trim().replace(/\/+$/, '');

/**
 * Build public file URL for Supabase Storage
 * Format: {storageUrl}/storage/v1/object/public/{bucket}/{key}
 */
export const buildSupabasePublicUrl = (
  baseUrl: string,
  bucket: string,
  key: string
): string => {
  const normalized = normalizeSupabaseStorageUrl(baseUrl);
  return `${normalized}/storage/v1/object/public/${bucket}/${key}`;
};

/**
 * List files in Supabase Storage bucket
 * Uses Supabase REST API (POST /storage/v1/object/list/{bucket})
 */
export const listSupabaseStorageFiles = async (
  settings: SupabaseStorageSettings,
  prefix: string
): Promise<
  Array<{ key: string; size: number; lastModified: string }>
> => {
  const storageUrl = normalizeSupabaseStorageUrl(settings.storageUrl);
  const bucket = settings.bucket;

  // Use Supabase Storage list API
  const listUrl = `${storageUrl}/storage/v1/object/list/${bucket}`;

  const response = await fetch(listUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: settings.anonKey,
      Authorization: `Bearer ${settings.anonKey}`
    },
    body: JSON.stringify({
      prefix: prefix || '',
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[Supabase Storage] List failed:', {
      status: response.status,
      url: listUrl,
      error: errorText
    });
    throw new Error(
      `Supabase Storage list failed (${response.status}): ${errorText.substring(
        0,
        200
      )}`
    );
  }

  const files = await response.json();

  // Supabase Storage returns array of file objects
  // file.name is the full path within the bucket (e.g., "patientId/123-filename.pdf")
  const result = (files || []).map((file: any) => ({
    key: file.name,  // Already includes full path within bucket
    size: file.metadata?.size || 0,
    lastModified: file.updated_at || file.created_at || ''
  }));

  console.log('[Supabase Storage] List response:', {
    prefix,
    bucket,
    fileCount: result.length,
    files: result.map(f => f.key)
  });

  return result;
};

/**
 * Upload file to Supabase Storage
 * Uses Supabase REST API (POST /storage/v1/object/{bucket}/{key})
 */
export const uploadSupabaseStorageFile = async (
  settings: SupabaseStorageSettings,
  key: string,
  file: File,
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void,
  _onChunkComplete?: (
    chunkSize: number,
    bytesAccepted: number,
    bytesTotal: number
  ) => void,
  shouldAbort?: () => boolean
): Promise<void> => {
  const storageUrl = normalizeSupabaseStorageUrl(settings.storageUrl);
  const bucket = settings.bucket;
  const uploadUrl = `${storageUrl}/storage/v1/object/${bucket}/${key}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Supabase Storage requires PUT for uploads (not POST)
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('apikey', settings.anonKey);
    xhr.setRequestHeader('Authorization', `Bearer ${settings.anonKey}`);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    let lastLoaded = 0;
    xhr.upload.onprogress = event => {
      if (shouldAbort && shouldAbort()) {
        xhr.abort();
        reject(
          new Error('Storage settings changed during upload. Please retry.')
        );
        return;
      }

      if (!event.lengthComputable) return;

      if (onProgress) {
        onProgress(event.loaded, event.total);
      }

      if (event.loaded > lastLoaded) {
        lastLoaded = event.loaded;
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Supabase Storage upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () =>
      reject(
        new Error('Supabase Storage upload failed due to a network error.')
      );

    if (shouldAbort && shouldAbort()) {
      xhr.abort();
      reject(
        new Error('Storage settings changed during upload. Please retry.')
      );
      return;
    }

    xhr.send(file);
  });
};

/**
 * Delete file from Supabase Storage
 * Uses Supabase REST API (DELETE /storage/v1/object/{bucket}/{keys})
 */
export const deleteSupabaseStorageFile = async (
  settings: SupabaseStorageSettings,
  key: string
): Promise<void> => {
  const storageUrl = normalizeSupabaseStorageUrl(settings.storageUrl);
  const bucket = settings.bucket;
  const deleteUrl = `${storageUrl}/storage/v1/object/${bucket}`;

  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      apikey: settings.anonKey,
      Authorization: `Bearer ${settings.anonKey}`
    },
    body: JSON.stringify([key])
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Supabase Storage delete failed (${response.status}): ${errorText.substring(
        0,
        200
      )}`
    );
  }
};
