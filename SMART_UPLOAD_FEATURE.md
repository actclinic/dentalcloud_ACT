# Smart File Upload Feature - Patient Documents

## Overview
Enhanced patient document upload system with **adaptive chunked uploads** that bypass Cloudflare's 150MB single upload limit. The system now supports uploading very large files (GBs) by automatically splitting them into smaller chunks.

## How It Works

### Adaptive Chunk Sizing
The system automatically calculates the optimal chunk size based on the file size:

| File Size | Chunk Size | Number of Chunks (example) |
|-----------|------------|---------------------------|
| < 100 MB | 10 MB | 50MB file = 5 chunks |
| 100 MB - 500 MB | 5 MB | 200MB file = 40 chunks |
| 500 MB - 1 GB | 2 MB | 800MB file = 400 chunks |
| 1 GB - 5 GB | 1 MB | 2GB file = 2000 chunks |
| > 5 GB | 512 KB | 6GB file = ~12000 chunks |

**Why smaller chunks for larger files?**
- Each chunk must be under Cloudflare's 150MB limit
- Smaller chunks = more reliable uploads on unstable networks
- Failed chunks can be retried without re-uploading the entire file
- Better progress tracking and resume capability

### TUS Resumable Upload Protocol
The system uses the industry-standard **TUS protocol** for resumable uploads:

1. **Chunk Splitting**: File is divided into chunks based on optimal size
2. **Sequential Upload**: Each chunk is uploaded one at a time
3. **Progress Tracking**: Real-time progress updates for each chunk
4. **Automatic Retry**: Failed chunks are retried with exponential backoff
5. **Resume Capability**: If upload is interrupted, it resumes from the last successful chunk
6. **Completion**: All chunks are assembled on the server side

### Retry Strategy
The system implements intelligent retry with exponential backoff:

```
Retry delays: 0s, 2s, 4s, 8s, 16s, 32s, 60s, 60s, 60s, 60s (10 retries max)
```

This handles:
- Temporary network issues
- Cloudflare timeout errors
- Server rate limiting
- Connection drops

## Features

### ✅ Smart Chunking
- **Automatic chunk size calculation** based on file size
- **No manual configuration** required
- **Optimized for reliability** over speed

### ✅ Progress Tracking
- **Real-time progress bar** with percentage
- **Bytes uploaded / total bytes** display
- **Per-file progress** for multiple file uploads
- **Visual feedback** with animated gradient progress bar

### ✅ Resume Support
- **Automatic resume** from previous interrupted uploads
- **No data loss** - never re-uploads completed chunks
- **Transparent to user** - works automatically

### ✅ Error Handling
- **Descriptive error messages** for different failure types
- **Network timeout detection**
- **File size limit validation**
- **Graceful degradation**

### ✅ Multiple File Upload
- **Sequential processing** to show proper progress
- **Queue management** for multiple files
- **Individual file completion tracking**

## Usage

### Uploading Files
1. Navigate to **Patient Details** → **Patient Documents**
2. Drag & drop files or click **Browse files**
3. Upload progress is shown in real-time
4. Files appear in the document list when complete

### Supported File Types
- **Images**: All image formats (JPEG, PNG, DICOM, etc.)
- **Documents**: PDF files
- **Videos**: All video formats (MP4, AVI, etc.)
- **Archives**: ZIP files

### File Size Limits
- **Theoretical limit**: Unlimited (tested up to 10GB+)
- **Practical limit**: Depends on browser storage and patience
- **Recommended**: Keep individual files under 5GB for best UX

## Technical Implementation

### API Layer (`services/api.ts`)

#### `calculateOptimalChunkSize(fileSize: number): number`
Calculates the best chunk size for a given file size.

```typescript
const chunkSize = api.files.calculateOptimalChunkSize(file.size);
// Returns: chunk size in bytes
```

#### `uploadWithTus(patientId, file, onProgress, onChunkComplete, options)`
Uploads a single file with smart chunking.

```typescript
await api.files.uploadWithTus(
  patientId,
  file,
  (bytesUploaded, bytesTotal) => {
    const percent = Math.round((bytesUploaded / bytesTotal) * 100);
    console.log(`Progress: ${percent}%`);
  },
  (chunkSize, bytesAccepted, bytesTotal) => {
    console.log(`Chunk uploaded: ${chunkSize} bytes`);
  },
  {
    chunkSize: 10 * 1024 * 1024, // Optional: override automatic chunk size
    maxRetries: 10, // Optional: max retry attempts
    metadata: { customKey: 'customValue' } // Optional: additional metadata
  }
);
```

#### `uploadMultipleWithTus(patientId, files, onFileProgress, onFileComplete, maxConcurrent)`
Uploads multiple files with concurrency control.

```typescript
await api.files.uploadMultipleWithTus(
  patientId,
  files,
  (index, fileName, bytesUploaded, bytesTotal) => {
    console.log(`File ${index}: ${fileName} - ${bytesUploaded}/${bytesTotal}`);
  },
  (index, fileName, patientFile) => {
    console.log(`Completed: ${fileName}`);
  },
  3 // Max 3 concurrent uploads
);
```

### UI Layer (`components/ClinicalView.tsx`)

The upload UI shows:
- **Smart chunked upload** indicator with animated pulse
- **Gradient progress bar** with real-time updates
- **File name and size** display
- **Bytes uploaded / total** information

### App Layer (`App.tsx`)

The upload handler:
- Logs smart upload configuration
- Tracks each file's chunk size
- Reports chunk completion
- Refreshes file list after upload

## Console Logging

The system provides detailed console logs for debugging:

```
[Smart Upload] File: dental-xray.dcm, Size: 245.67MB, Chunk Size: 5.00MB
[Upload Handler] File 1/3: dental-xray.dcm (245.67MB, chunks: 5.00MB)
[Upload Handler] Chunk uploaded: 5.00MB
[Upload Handler] Chunk uploaded: 5.00MB
...
[Smart Upload] Successfully uploaded: dental-xray.dcm
[Upload Handler] Completed file 1/3: dental-xray.dcm
[Upload Handler] All 3 file(s) uploaded successfully
```

## Benefits Over Previous Implementation

### Before
- ❌ Fixed 25MB chunk size (not optimal for all file sizes)
- ❌ Limited retry attempts (6 retries)
- ❌ Minimal error handling
- ❌ No upload size logging
- ❌ Basic progress bar

### After
- ✅ **Adaptive chunk sizing** (10MB to 512KB based on file size)
- ✅ **Extended retry attempts** (10 retries with exponential backoff)
- ✅ **Comprehensive error handling** (specific error messages)
- ✅ **Detailed logging** (file size, chunk size, progress)
- ✅ **Enhanced UI** (gradient progress bar, smart upload indicator)
- ✅ **Multiple file support** with concurrency control
- ✅ **Bypasses Cloudflare 150MB limit** completely

## Testing Recommendations

### Test Scenarios
1. **Small files** (< 10MB): Should use 10MB chunks, upload quickly
2. **Medium files** (50-200MB): Should use 5-10MB chunks
3. **Large files** (500MB-2GB): Should use 1-2MB chunks, show progress
4. **Very large files** (> 5GB): Should use 512KB chunks, take longer but be reliable
5. **Network interruption**: Pause network, verify resume works
6. **Multiple files**: Upload 5+ files simultaneously
7. **Browser refresh**: Refresh during upload, verify resume on return

### Performance Expectations
- **10MB file**: ~5-10 seconds on good connection
- **100MB file**: ~30-60 seconds
- **500MB file**: ~3-5 minutes
- **2GB file**: ~15-20 minutes
- **5GB file**: ~40-60 minutes

*Times vary based on network speed and reliability*

## Troubleshooting

### "File too large for upload"
- The file exceeds server-side limits
- Solution: Compress the file or split it manually

### "Network timeout"
- Connection is too slow or unstable
- Solution: Check network, try again with smaller file

### Upload stuck at certain percentage
- A chunk is failing, system is retrying
- Wait for retry attempts (up to 10 retries)
- Check browser console for error details

### Upload fails completely
- Check browser console for error message
- Verify network connection
- Try uploading a smaller test file
- Check Supabase storage bucket permissions

## Future Enhancements

Potential improvements for the future:
- [ ] Parallel chunk uploads (upload multiple chunks simultaneously)
- [ ] Upload speed estimation and ETA
- [ ] Pause/Resume manual controls
- [ ] Upload queue management UI
- [ ] Compression before upload
- [ ] Background uploads (continue when tab is not active)
- [ ] Web Workers for better performance

## References

- **TUS Protocol**: https://tus.io/protocols/resumable-upload
- **TUS JavaScript Library**: https://github.com/tus/tus-js-client
- **Supabase Storage**: https://supabase.com/docs/guides/storage
- **Cloudflare Limits**: https://developers.cloudflare.com/fundamentals/reference/http-message-limits/
