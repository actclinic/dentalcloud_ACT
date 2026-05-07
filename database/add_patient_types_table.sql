-- Create admin-managed patient types and remove hardcoded patient_type checks.
-- Safe for existing databases.

CREATE TABLE IF NOT EXISTS patient_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO patient_types (name, sort_order, is_active)
VALUES
  ('Walk-in', 0, true),
  ('ONP', 1, true),
  ('RNP', 2, true),
  ('OTP', 3, true),
  ('Hotline', 4, true),
  ('Rec-ph call', 5, true),
  ('Tiktok', 6, true),
  ('Tiktok Hotline', 7, true)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE patients
ALTER COLUMN patient_type TYPE VARCHAR(100);

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname
  INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'patients'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%patient_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE patients DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE patients
ALTER COLUMN patient_type SET DEFAULT 'Walk-in';

CREATE INDEX IF NOT EXISTS idx_patient_types_sort_order ON patient_types(sort_order);
CREATE INDEX IF NOT EXISTS idx_patient_types_active ON patient_types(is_active);
CREATE INDEX IF NOT EXISTS idx_patients_patient_type ON patients(patient_type);

COMMENT ON TABLE patient_types IS 'Admin-managed patient type options used in patient registration and edits.';
COMMENT ON COLUMN patients.patient_type IS 'Selected patient type label from the patient_types table.';
