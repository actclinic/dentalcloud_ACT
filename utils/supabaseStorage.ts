import * as tus from 'tus-js-client';
import { SupabaseStorageSettings } from '../types';

/**
 * Supabase Storage REST API utilities
 * Uses Supabase Storage TUS resumable upload API for large files.
 * Chunks are kept well below 90 MB so they always pass through the
 * Cloudflare tunnel (100 MB hard limit per request).
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
 * Choose an appropriate TUS chunk size based on the file size.
 * All chunks must be < 90 MB to safely pass through Cloudflare.
 * Supabase TUS requires chunk sizes that are multiples of 6 MB.
 *
 * Optimised for UNSTABLE internet connections — small chunks so each
 * request finishes quickly and failed chunks can be retried cheaply.
 */
const chooseTusChunkSize = (fileSize: number): number => {
  const MB = 1024 * 1024;
  // All files use 6 MB chunks — the smallest valid TUS chunk size.
  // This keeps each HTTP request short and retryable on flaky connections.
  // A 2 GB file = ~341 chunks, each finishing in seconds even on slow links.
  void fileSize; // kept for future tuning if network improves
  return 6 * MB;
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

  const listUrl = `${storageUrl}/storage/v1/object/list/${bucket}`;

  const requestBody = {
    prefix: prefix || '',
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' }
  };

  console.log('[Supabase Storage] List request:', {
    url: listUrl,
    bucket,
    prefix,
    body: requestBody
  });

  const response = await fetch(listUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: settings.anonKey,
      Authorization: `Bearer ${settings.anonKey}`
    },
    body: JSON.stringify(requestBody)
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

  console.log('[Supabase Storage] Raw list response:', {
    fileCount: files?.length || 0,
    files: files?.map((f: any) => ({ name: f.name, id: f.id })) || []
  });

  // Supabase Storage list API strips the prefix from returned file names.
  // Prepend it to reconstruct the full key.
  const result = (files || []).map((file: any) => ({
    key: prefix ? `${prefix}${file.name}` : file.name,
    size: file.metadata?.size || 0,
    lastModified: file.updated_at || file.created_at || ''
  }));

  console.log('[Supabase Storage] List response:', {
    prefix,
    bucket,
    fileCount: result.length,
    files: result.map((f: any) => f.key)
  });

  return result;
};

/**
 * Upload a file to the self-hosted Supabase Storage using TUS resumable
 * chunked uploads.  Every chunk is kept well below 90 MB so it passes
 * through Cloudflare without triggering the 100 MB per-request limit.
 *
 * Features:
 *  - Adaptive chunk size (12 MB – 72 MB depending on file size)
 *  - Automatic resume if the browser tab reloads mid-upload
 *  - Exponential-backoff retry on transient network errors
 *  - Abort on storage-settings change via `shouldAbort`
 *  - Progress reporting via `onProgress`
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

  // Supabase Storage TUS endpoint on the self-hosted instance
  const tusEndpoint = `${storageUrl}/storage/v1/upload/resumable`;

  const chunkSize = chooseTusChunkSize(file.size);

  console.log(
    `[Supabase Storage TUS] Uploading "${file.name}" ` +
      `(${(file.size / 1024 / 1024).toFixed(2)} MB) ` +
      `via TUS chunks of ${(chunkSize / 1024 / 1024).toFixed(0)} MB ` +
      `→ ${tusEndpoint}`
  );

  await new Promise<void>((resolve, reject) => {
    let aborted = false;

    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint,
      chunkSize,
      // Exponential back-off: 0 s, 2 s, 4 s, 8 s, 16 s, 32 s, 60 s, 60 s …
      retryDelays: [0, 2000, 4000, 8000, 16000, 32000, 60000, 60000],
      headers: {
        apikey: settings.anonKey,
        Authorization: `Bearer ${settings.anonKey}`,
        'x-upsert': 'true'
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: key,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600'
      },

      onProgress: (bytesUploaded, bytesTotal) => {
        // Honour abort requests triggered by settings changes
        if (shouldAbort && shouldAbort() && !aborted) {
          aborted = true;
          upload.abort(true).finally(() => {
            reject(
              new Error(
                'Storage settings changed during upload. Please retry.'
              )
            );
          });
          return;
        }
        if (onProgress) onProgress(bytesUploaded, bytesTotal);
      },

      onChunkComplete: (chunkSz, bytesAccepted, bytesTotal) => {
        if (shouldAbort && shouldAbort() && !aborted) {
          aborted = true;
          upload.abort(true).finally(() => {
            reject(
              new Error(
                'Storage settings changed during upload. Please retry.'
              )
            );
          });
          return;
        }
        console.log(
          `[Supabase Storage TUS] Chunk done – ` +
            `${(bytesAccepted / 1024 / 1024).toFixed(1)} / ` +
            `${(bytesTotal / 1024 / 1024).toFixed(1)} MB`
        );
        if (_onChunkComplete) _onChunkComplete(chunkSz, bytesAccepted, bytesTotal);
      },

      onSuccess: () => {
        if (shouldAbort && shouldAbort()) {
          reject(
            new Error(
              'Storage settings changed during upload. Please retry.'
            )
          );
          return;
        }
        console.log(`[Supabase Storage TUS] Upload complete: "${key}"`);
        resolve();
      },

      onError: (error) => {
        if (aborted) return;
        const msg = error?.message || String(error);
        console.error('[Supabase Storage TUS] Upload error:', msg);

        if (msg.includes('413') || msg.toLowerCase().includes('too large')) {
          reject(
            new Error(
              'File chunk rejected as too large. The server or proxy limit may be lower than expected.'
            )
          );
        } else if (
          msg.includes('timeout') ||
          msg.toLowerCase().includes('network')
        ) {
          reject(
            new Error(
              'Network timeout during upload. Please check your connection and try again.'
            )
          );
        } else if (
          msg.includes('403') ||
          msg.toLowerCase().includes('permission')
        ) {
          reject(
            new Error(
              'Permission denied. Please check your storage bucket policies and keys.'
            )
          );
        } else {
          reject(new Error(`Upload failed: ${msg}`));
        }
      }
    });

    // Resume any previous interrupted upload automatically
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) {
          console.log(
            `[Supabase Storage TUS] Resuming previous upload for "${key}"`
          );
          upload.resumeFromPreviousUpload(previous[0]);
        }
        upload.start();
      })
      .catch((err) => {
        console.warn(
          '[Supabase Storage TUS] Could not check for previous uploads:',
          err
        );
        upload.start();
      });
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
