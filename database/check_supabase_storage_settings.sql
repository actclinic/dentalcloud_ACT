-- ============================================================================
-- DIAGNOSTIC: Check if Supabase Storage settings are saved correctly
-- ============================================================================
-- Run this in your OFFICIAL SUPABASE CLOUD SQL Editor

-- Check current settings
SELECT '=== CURRENT APP_SETTINGS ===' as step;

SELECT 
  id,
  'S3 URL' as field, COALESCE(s3_url, '(NULL)') as value FROM app_settings WHERE id = 1
UNION ALL SELECT id, 'S3 Region', COALESCE(s3_region, '(NULL)') FROM app_settings WHERE id = 1
UNION ALL SELECT id, 'STORAGE URL', COALESCE(storage_url, '(NULL)') FROM app_settings WHERE id = 1
UNION ALL SELECT id, 'STORAGE BUCKET', COALESCE(storage_bucket, '(NULL)') FROM app_settings WHERE id = 1
UNION ALL SELECT id, 'STORAGE ANON KEY (first 20)', COALESCE(LEFT(storage_anon_key, 20), '(NULL)') FROM app_settings WHERE id = 1
UNION ALL SELECT id, 'STORAGE SERVICE KEY (first 20)', COALESCE(LEFT(storage_service_key, 20), '(NULL)') FROM app_settings WHERE id = 1;

-- ============================================================================
-- FIX: If STORAGE URL is NULL, run this UPDATE:
-- ============================================================================

-- UNCOMMENT AND FILL IN YOUR ACTUAL VALUES BEFORE RUNNING:
/*
UPDATE app_settings SET
  -- Supabase Storage REST API settings
  storage_url = 'https://supapi.nationalcancercenter.click',  -- Your self-hosted Supabase URL
  storage_bucket = 'patient_files',                             -- Bucket name
  storage_anon_key = 'sb_publishable_...',                      -- YOUR actual anon key
  storage_service_key = 'sb_secret_...',                        -- YOUR actual service key
  
  -- Clear old S3 settings (optional)
  s3_url = NULL,
  s3_access_key = NULL,
  s3_secret_key = NULL,
  s3_region = NULL,
  
  updated_at = NOW()
WHERE id = 1;
*/

-- After running UPDATE, verify:
SELECT '=== VERIFICATION ===' as step;
SELECT 
  CASE 
    WHEN storage_url IS NOT NULL AND storage_anon_key IS NOT NULL AND storage_bucket IS NOT NULL 
    THEN '✅ Supabase Storage settings are configured'
    ELSE '❌ Supabase Storage settings are NULL - need to configure!'
  END as status
FROM app_settings WHERE id = 1;
