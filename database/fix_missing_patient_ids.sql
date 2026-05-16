-- ============================================================================
-- FIX: Backfill any patients still missing patient_unique_id
-- ============================================================================
-- Run this if your migration already ran but some patients still show
-- "N/A" for their unique ID. This script catches any stragglers,
-- re-syncs the sequence, and enforces the NOT NULL constraint safely.
-- ============================================================================

-- Step 1: Ensure the sequence exists
CREATE SEQUENCE IF NOT EXISTS patient_id_seq START 1;

-- Step 2: Drop NOT NULL constraint if it was partially applied
-- (so we can safely backfill the remaining NULL rows)
ALTER TABLE patients 
ALTER COLUMN patient_unique_id DROP NOT NULL;

-- Step 3: Backfill any patients that are still missing patient_unique_id
-- Uses a DO block cursor loop ordered by created_at for deterministic IDs
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

-- Step 4: Reset the sequence to continue from the highest assigned number
SELECT setval('patient_id_seq', COALESCE((
  SELECT MAX(CAST(SUBSTRING(patient_unique_id FROM 5) AS INTEGER))
  FROM patients
  WHERE patient_unique_id ~ '^PAT-[0-9]{5}$'
), 0));

-- Step 5: Verify no NULLs remain before adding NOT NULL
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM patients WHERE patient_unique_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION '% patients still have NULL patient_unique_id after backfill!', null_count;
  END IF;
END;
$$;

-- Step 6: Re-apply NOT NULL constraint
ALTER TABLE patients
ALTER COLUMN patient_unique_id SET NOT NULL;

-- Step 7: Ensure the unique index exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_patient_unique_id
ON patients(patient_unique_id);

-- Step 8: Ensure the trigger exists for new patients
CREATE OR REPLACE FUNCTION assign_patient_unique_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.patient_unique_id IS NULL THEN
    NEW.patient_unique_id := 'PAT-' || LPAD(nextval('patient_id_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_patient_unique_id ON patients;
CREATE TRIGGER trg_assign_patient_unique_id
BEFORE INSERT ON patients
FOR EACH ROW
EXECUTE FUNCTION assign_patient_unique_id();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT '=== FIX COMPLETE ===' as status;
SELECT COUNT(*) AS total_patients, COUNT(patient_unique_id) AS with_id, COUNT(*) - COUNT(patient_unique_id) AS missing_id FROM patients;
