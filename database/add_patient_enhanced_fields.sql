-- ============================================================================
-- MIGRATION: Add Enhanced Patient Information Fields
-- ============================================================================
-- This migration adds age, address, city, state/region, and patient_type 
-- to the patients table.
-- 
-- Run this script to update an existing database without losing data.
-- All new fields are nullable for backward compatibility.
-- ============================================================================

-- Add new columns to patients table
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state_region VARCHAR(100),
ADD COLUMN IF NOT EXISTS patient_type VARCHAR(50) DEFAULT 'walk-in' 
  CHECK (patient_type IN ('online', 'walk-in', 'phone call', 'hotline', 'tiktok', 'tiktok hotline', 'otp', 'OTP'));

-- Add index for patient_type for filtering
CREATE INDEX IF NOT EXISTS idx_patients_patient_type ON patients(patient_type);

-- Add index for city for location-based queries
CREATE INDEX IF NOT EXISTS idx_patients_city ON patients(city);

-- Add comment for documentation
COMMENT ON COLUMN patients.age IS 'Patient age in years';
COMMENT ON COLUMN patients.address IS 'Street address';
COMMENT ON COLUMN patients.city IS 'City (Myanmar cities from myanmar-cities library)';
COMMENT ON COLUMN patients.state_region IS 'State/Region in Myanmar';
COMMENT ON COLUMN patients.patient_type IS 'Patient source: online, walk-in, phone call, hotline, tiktok, tiktok hotline, OTP';

-- Verification
SELECT 'Migration completed successfully!' as status;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'patients' 
  AND column_name IN ('age', 'address', 'city', 'state_region', 'patient_type')
ORDER BY column_name;
