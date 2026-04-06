-- ============================================================================
-- S3 SETTINGS MIGRATION SCRIPT
-- ============================================================================
-- Run this script in your Supabase SQL Editor to add S3 bucket configuration
-- support to your existing database.
-- 
-- This script is safe to run multiple times - it checks for existing objects
-- before creating them.
-- ============================================================================

-- ============================================================================
-- 1. CREATE app_settings TABLE (IF NOT EXISTS)
-- ============================================================================
-- This table stores global application settings including S3 bucket configuration.
-- It uses a singleton pattern (only one row with id = 1).

CREATE TABLE IF NOT EXISTS app_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  s3_url TEXT,
  s3_access_key TEXT,
  s3_secret_key TEXT,
  s3_region TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. ADD S3 COLUMNS (IF THEY DON'T EXIST - FOR EXISTING DATABASES)
-- ============================================================================
-- If the table already exists from previous setup, ensure S3 columns are present.
-- These ALTER statements will only succeed if the columns don't exist yet.

DO $$
BEGIN
  -- Add s3_url column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_settings' AND column_name = 's3_url'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN s3_url TEXT;
  END IF;

  -- Add s3_access_key column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_settings' AND column_name = 's3_access_key'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN s3_access_key TEXT;
  END IF;

  -- Add s3_secret_key column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_settings' AND column_name = 's3_secret_key'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN s3_secret_key TEXT;
  END IF;

  -- Add s3_region column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_settings' AND column_name = 's3_region'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN s3_region TEXT;
  END IF;

  -- Add created_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_settings' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Add updated_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_settings' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE TRIGGER FUNCTION FOR updated_at (IF NOT EXISTS)
-- ============================================================================
-- This function automatically updates the updated_at timestamp on row updates.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- 4. CREATE TRIGGER (IF NOT EXISTS)
-- ============================================================================
-- Apply the updated_at trigger to app_settings table.

DO $$
BEGIN
  -- Check if trigger exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_app_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_app_settings_updated_at
        BEFORE UPDATE ON app_settings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- 5. INSERT DEFAULT ROW (IF NOT EXISTS)
-- ============================================================================
-- Insert the singleton row (id = 1) if it doesn't exist yet.
-- This allows the application to read/write S3 settings.

INSERT INTO app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================
-- Confirm the setup is correct

SELECT '=== S3 SETTINGS MIGRATION COMPLETE ===' as status;

-- Check if app_settings table exists
SELECT 'app_settings table exists' as check_name, 
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables WHERE table_name = 'app_settings'
       ) THEN '✅ YES' ELSE '❌ NO' END as result;

-- Check if all S3 columns exist
SELECT 's3_url column' as check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'app_settings' AND column_name = 's3_url'
       ) THEN '✅ YES' ELSE '❌ NO' END as result
UNION ALL
SELECT 's3_access_key column',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'app_settings' AND column_name = 's3_access_key'
       ) THEN '✅ YES' ELSE '❌ NO' END
UNION ALL
SELECT 's3_secret_key column',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'app_settings' AND column_name = 's3_secret_key'
       ) THEN '✅ YES' ELSE '❌ NO' END
UNION ALL
SELECT 's3_region column',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'app_settings' AND column_name = 's3_region'
       ) THEN '✅ YES' ELSE '❌ NO' END;

-- Check if default row exists
SELECT 'Default row exists' as check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM app_settings WHERE id = 1
       ) THEN '✅ YES' ELSE '❌ NO' END as result;

-- Show current app_settings structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'app_settings'
ORDER BY ordinal_position;

SELECT '=== MIGRATION SUCCESSFUL - S3 SETTINGS READY ===' as final_message;
