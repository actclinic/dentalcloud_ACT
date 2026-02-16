-- Supabase Auth Integration Migration
-- Run this SQL in your Supabase SQL Editor to enable Supabase Auth integration

-- 1. Add Supabase user ID reference to patient_auth table
ALTER TABLE patient_auth 
ADD COLUMN IF NOT EXISTS supabase_user_id UUID;

-- 2. Create index for faster lookups on supabase_user_id
CREATE INDEX IF NOT EXISTS idx_patient_auth_supabase_user_id 
ON patient_auth(supabase_user_id);

-- NOTE: We do NOT create a trigger on auth.users because:
-- 1. It can cause "Database error saving new user" during signup
-- 2. The linking is handled by our application code in api.ts (registerWithSupabase)
-- 3. Triggers on auth.users require special permissions that can fail

-- If you previously ran the migration with the trigger, remove it:
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_supabase_user();

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'patient_auth' 
ORDER BY ordinal_position;
