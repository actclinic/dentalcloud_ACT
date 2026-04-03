# Upload Troubleshooting Guide

## Issue: 20MB File Fails at 10MB (50%)

### Root Cause Analysis

When a 20MB file fails at exactly 10MB (50%), this indicates:
- ✅ **First chunk (10MB) uploads successfully**
- ❌ **Second chunk (10MB) fails**

This is NOT a Netlify issue because TUS uploads go **directly to Supabase**.

### Possible Causes & Solutions

#### 1. **Supabase Storage Bucket File Size Limit** ⚠️ MOST LIKELY

Even though you set the limit to 50MB in Supabase, there might be multiple limits:

**Check These:**
1. Go to Supabase Dashboard → Storage → `patient_files` bucket
2. Click on bucket settings
3. Verify **File size limit** is actually set to 50MB (52428800 bytes)
4. Check if there's a **bucket-level policy** overriding the limit

**How to Fix:**
```sql
-- Run this in Supabase SQL Editor to check current bucket config
SELECT id, name, file_size_limit, public 
FROM storage.buckets 
WHERE name = 'patient_files';

-- Update file size limit to 50MB (52428800 bytes)
UPDATE storage.buckets 
SET file_size_limit = 52428800 
WHERE name = 'patient_files';
```

#### 2. **TUS Endpoint Chunk Size Limit**

The Supabase TUS endpoint might have its own chunk size restrictions.

**Solution:** The system now automatically retries with smaller chunks:
- First attempt: 10MB chunks
- Second attempt: 5MB chunks (if first fails)
- Third attempt: 2.5MB chunks (if second fails)

#### 3. **Authentication Token Expiry**

If the upload takes too long, the Supabase auth token might expire.

**Solution:** Check browser console for 401/403 errors during upload.

#### 4. **Network Timeout or Firewall**

Some networks/firewalls block large uploads or have timeout limits.

**Test:**
- Try uploading from a different network (mobile hotspot)
- Check browser console for timeout errors
- Try uploading a smaller file (5MB) to verify it works

### Diagnostic Steps

#### Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try uploading the 20MB file
4. Look for error messages like:
   - `[Smart Upload] TUS upload error`
   - HTTP status codes (413, 403, 500, etc.)
   - Specific error messages

#### Step 2: Check Supabase Logs
1. Go to Supabase Dashboard
2. Navigate to **Logs** → **Storage**
3. Look for failed upload attempts
4. Check the error details

#### Step 3: Test with Smaller File
1. Try uploading a 5MB file
2. If it works → Issue is with file size limit
3. If it fails → Issue is with configuration/network

#### Step 4: Verify Bucket Configuration
Run this SQL in Supabase SQL Editor:

```sql
-- Check bucket configuration
SELECT 
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  owner
FROM storage.buckets 
WHERE name = 'patient_files';
```

Expected output:
```
name: patient_files
public: true (or false)
file_size_limit: 52428800 (50MB in bytes)
```

### Quick Fix: Reduce Chunk Size

If the issue persists, you can manually force smaller chunks by modifying the upload handler in `App.tsx`:

```typescript
// Force 2MB chunks for all files
await api.files.uploadWithTus(
  selectedPatient.id,
  file,
  (bytesUploaded, bytesTotal) => {
    // progress callback
  },
  undefined,
  { 
    chunkSize: 2 * 1024 * 1024, // Force 2MB chunks
    maxRetries: 10
  }
);
```

### What the System Does Now

The enhanced upload system now:

1. ✅ **Automatically retries with smaller chunks** (up to 3 attempts)
2. ✅ **Shows detailed error messages** to identify the exact issue
3. ✅ **Logs everything** to browser console for debugging
4. ✅ **Handles specific error types** (413, 403, timeout, etc.)

### Next Steps

1. **Check the browser console** when the upload fails - it will show the exact error
2. **Verify Supabase bucket limit** using the SQL query above
3. **Try the upload again** - the system will automatically retry with smaller chunks
4. **Share the console error** if it still fails, and I can provide a more specific fix

### Common Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| 413 | Payload Too Large | Increase bucket file_size_limit |
| 403 | Forbidden | Check storage policies and permissions |
| 401 | Unauthorized | Auth token expired, re-login |
| 500 | Server Error | Supabase issue, check logs |
| timeout | Network timeout | Check network, reduce chunk size |
| network | Connection error | Check internet connection |

### Contact Support

If none of the above works, provide:
1. Browser console error logs
2. Supabase storage logs
3. File size and type you're trying to upload
4. Your Supabase project ID (first few characters)
