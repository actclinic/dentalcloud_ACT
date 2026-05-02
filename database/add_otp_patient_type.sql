-- Allow OTP as a patient source/operator type.
-- Safe to run on existing databases after patient_type already exists.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT tc.constraint_name
  INTO constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.check_constraints cc
    ON cc.constraint_schema = tc.constraint_schema
   AND cc.constraint_name = tc.constraint_name
  WHERE tc.constraint_schema = 'public'
    AND tc.table_name = 'patients'
    AND tc.constraint_type = 'CHECK'
    AND cc.check_clause ILIKE '%patient_type%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE patients DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE patients
ADD CONSTRAINT patients_patient_type_check
CHECK (
  patient_type IN (
    'Walk-in',
    'ONP',
    'RNP',
    'OTP',
    'Hotline',
    'Rec-ph call',
    'Tiktok',
    'Tiktok Hotline',
    'online',
    'walk-in',
    'phone call',
    'hotline',
    'tiktok',
    'tiktok hotline',
    'otp'
  )
);

COMMENT ON COLUMN patients.patient_type IS 'Patient source/operator type: Walk-in, ONP, RNP, OTP, Hotline, Rec-ph call, Tiktok, Tiktok Hotline.';
