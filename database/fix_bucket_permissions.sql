-- ============================================================================
-- FIX VANISHING FILES: Check and Fix Bucket Permissions
-- ============================================================================
-- IMPORTANT: Run this in your SELF-HOSTED Supabase (not the official cloud!)
-- This checks if the patient_files bucket is set to PUBLIC
-- ============================================================================

-- Step 1: Check current bucket settings
SELECT '=== CURRENT BUCKET SETTINGS ===' as step;

SELECT 
  id,
  name,
  public as is_public,
  created_at
FROM storage.buckets
WHERE name = 'patient_files';

-- Expected: Should show public = true
-- If public = false, that's why files "vanish" (can't access them)

-- ============================================================================
-- Step 2: Make bucket PUBLIC (if needed)
-- ============================================================================

UPDATE storage.buckets
SET public = true
WHERE name = 'patient_files';

-- ============================================================================
-- Step 3: Verify the update
-- ============================================================================

SELECT '=== UPDATED BUCKET SETTINGS ===' as step;

SELECT 
  id,
  name,
  public as is_public,
  created_at
FROM storage.buckets
WHERE name = 'patient_files';

-- Expected: public should now be true

-- ============================================================================
-- Step 4: Check if files were actually uploaded
-- ============================================================================

SELECT '=== UPLOADED FILES ===' as step;

SELECT 
  id,
  bucket_id,
  name as file_path,
  size,
  created_at
FROM storage.objects
WHERE bucket_id = 'patient_files'
ORDER BY created_at DESC
LIMIT 10;

-- This shows the last 10 uploaded files
-- If you see files here, they uploaded successfully!
-- The issue is just the public permission

-- ============================================================================
-- Step 5: Check RLS policies (if any)
-- ============================================================================

SELECT '=== RLS POLICIES ON storage.objects ===' as step;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage';

-- If there are restrictive RLS policies, they might block access
-- For now, the easiest fix is to make the bucket public (done above)

SELECT '=== DONE ===' as final;
SELECT 'Check if files are now accessible' as next_step;
