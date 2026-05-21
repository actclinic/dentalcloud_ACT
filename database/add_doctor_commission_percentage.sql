-- ============================================================================
-- MIGRATION: Doctor Commission Percentage
-- ============================================================================
-- Purpose:
-- Add commission_percentage to doctors table to track doctor earnings
-- Add doctor_earnings to treatments table to store calculated commission per treatment
--
-- Safe to run multiple times.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. doctors table: add commission_percentage column
-- ----------------------------------------------------------------------------
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5,2) DEFAULT 0;

ALTER TABLE doctors
  DROP CONSTRAINT IF EXISTS doctors_commission_percentage_check;

ALTER TABLE doctors
  ADD CONSTRAINT doctors_commission_percentage_check
  CHECK (commission_percentage >= 0 AND commission_percentage <= 100);

UPDATE doctors
SET commission_percentage = COALESCE(commission_percentage, 0)
WHERE commission_percentage IS NULL;

-- ----------------------------------------------------------------------------
-- 2. treatments table: add doctor_earnings column
-- ----------------------------------------------------------------------------
ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS doctor_earnings DECIMAL(12,2) DEFAULT 0;

ALTER TABLE treatments
  DROP CONSTRAINT IF EXISTS treatments_doctor_earnings_check;

ALTER TABLE treatments
  ADD CONSTRAINT treatments_doctor_earnings_check
  CHECK (doctor_earnings >= 0);

UPDATE treatments
SET doctor_earnings = COALESCE(doctor_earnings, 0)
WHERE doctor_earnings IS NULL;

COMMIT;

-- Verification
SELECT
  'migration_ok' AS status,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'doctors' AND column_name = 'commission_percentage'
  ) AS has_commission_percentage,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'treatments' AND column_name = 'doctor_earnings'
  ) AS has_doctor_earnings;
