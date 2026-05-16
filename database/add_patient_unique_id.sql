-- ============================================================================
-- MIGRATION: Add patient_unique_id for human-readable patient identifiers
-- ============================================================================
-- This migration adds a patient_unique_id column (e.g., PAT-00001, PAT-00002)
-- with an auto-incrementing sequence and a trigger to auto-assign it on insert.
-- Run this script on an existing database without losing data.
-- ============================================================================

-- Step 1: Create a sequence for the numeric portion
CREATE SEQUENCE IF NOT EXISTS patient_id_seq START 1;

-- Step 2: Add the patient_unique_id column to patients table
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS patient_unique_id VARCHAR(20);

-- Step 3: Backfill existing rows with unique IDs based on created_at order
-- Uses a DO block with a cursor loop to assign IDs in created_at order
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM patients WHERE patient_unique_id IS NULL ORDER BY created_at ASC, id ASC
  LOOP
    UPDATE patients SET patient_unique_id = 'PAT-' || LPAD(nextval('patient_id_seq')::TEXT, 5, '0') WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Step 4: Reset sequence to continue from the highest assigned number
SELECT setval('patient_id_seq', COALESCE((
  SELECT MAX(CAST(SUBSTRING(patient_unique_id FROM 5) AS INTEGER)) 
  FROM patients 
  WHERE patient_unique_id ~ '^PAT-\d{5}$'
), 0));

-- Step 5: Add NOT NULL constraint and unique index
ALTER TABLE patients 
ALTER COLUMN patient_unique_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_patient_unique_id 
ON patients(patient_unique_id);

-- Step 6: Create a trigger function to auto-assign patient_unique_id on insert
CREATE OR REPLACE FUNCTION assign_patient_unique_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.patient_unique_id IS NULL THEN
    NEW.patient_unique_id := 'PAT-' || LPAD(nextval('patient_id_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Apply the trigger
DROP TRIGGER IF EXISTS trg_assign_patient_unique_id ON patients;
CREATE TRIGGER trg_assign_patient_unique_id
BEFORE INSERT ON patients
FOR EACH ROW
EXECUTE FUNCTION assign_patient_unique_id();
