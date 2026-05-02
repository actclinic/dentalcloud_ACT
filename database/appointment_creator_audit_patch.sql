-- Track which staff user created each appointment for audit and marketing reporting.
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by_user_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS guest_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS guest_notes TEXT,
ADD COLUMN IF NOT EXISTS converted_patient_id UUID REFERENCES patients(id) ON DELETE SET NULL;

-- Allow marketing/lead appointments before a patient profile exists.
-- Keep appointment history if a linked patient profile is later deleted.
ALTER TABLE appointments
ALTER COLUMN patient_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'appointments'
      AND constraint_name = 'appointments_patient_id_fkey'
  ) THEN
    ALTER TABLE appointments DROP CONSTRAINT appointments_patient_id_fkey;
  END IF;
END $$;

ALTER TABLE appointments
ADD CONSTRAINT appointments_patient_id_fkey
FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'appointments'
      AND constraint_name = 'appointments_registered_or_guest_check'
  ) THEN
    ALTER TABLE appointments
    ADD CONSTRAINT appointments_registered_or_guest_check
    CHECK (
      patient_id IS NOT NULL
      OR (
        NULLIF(BTRIM(COALESCE(guest_name, '')), '') IS NOT NULL
        AND NULLIF(BTRIM(COALESCE(guest_phone, '')), '') IS NOT NULL
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_created_by_user_id
ON appointments(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_appointments_created_at
ON appointments(created_at);

CREATE INDEX IF NOT EXISTS idx_appointments_guest_phone
ON appointments(guest_phone);

CREATE INDEX IF NOT EXISTS idx_appointments_guest_source
ON appointments(guest_source);
