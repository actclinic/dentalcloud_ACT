-- ============================================================================
-- MIGRATION: Doctor Commission Management
-- ============================================================================
-- Purpose:
-- Create doctor_treatment_commissions to store per-doctor commission rates
-- for specific treatments with full integrity, indexing, and audit support.
--
-- Safe to run multiple times.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Create table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_treatment_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL REFERENCES treatment_types(id) ON DELETE CASCADE,
  commission_rate DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doctor_treatment_commissions_doctor_treatment_key UNIQUE (doctor_id, treatment_id),
  CONSTRAINT doctor_treatment_commissions_commission_rate_check
    CHECK (commission_rate >= 0 AND commission_rate <= 100)
);

-- ----------------------------------------------------------------------------
-- 2. Performance indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_doctor_treatment_commissions_doctor_id
  ON doctor_treatment_commissions (doctor_id);

CREATE INDEX IF NOT EXISTS idx_doctor_treatment_commissions_treatment_id
  ON doctor_treatment_commissions (treatment_id);

-- ----------------------------------------------------------------------------
-- 2.1 Repair legacy foreign key if this table was previously created against
--     treatments(id) instead of treatment_types(id)
-- ----------------------------------------------------------------------------
ALTER TABLE doctor_treatment_commissions
DROP CONSTRAINT IF EXISTS doctor_treatment_commissions_treatment_id_fkey;

ALTER TABLE doctor_treatment_commissions
ADD CONSTRAINT doctor_treatment_commissions_treatment_id_fkey
FOREIGN KEY (treatment_id)
REFERENCES treatment_types(id)
ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 3. Audit trigger for updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_doctor_treatment_commissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doctor_treatment_commissions_updated_at
ON doctor_treatment_commissions;

CREATE TRIGGER trg_doctor_treatment_commissions_updated_at
BEFORE UPDATE ON doctor_treatment_commissions
FOR EACH ROW
EXECUTE FUNCTION set_doctor_treatment_commissions_updated_at();

-- ----------------------------------------------------------------------------
-- 4. RPC: resolve doctor commission for a treatment
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_applicable_commission_rate(
  p_doctor_id UUID,
  p_treatment_id UUID
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_custom_rate DECIMAL(5,2);
  v_default_rate DECIMAL(5,2);
BEGIN
  SELECT dtc.commission_rate
  INTO v_custom_rate
  FROM doctor_treatment_commissions dtc
  WHERE dtc.doctor_id = p_doctor_id
    AND dtc.treatment_id = p_treatment_id
  LIMIT 1;

  IF v_custom_rate IS NOT NULL THEN
    RETURN v_custom_rate;
  END IF;

  SELECT COALESCE(d.commission_percentage, 0)
  INTO v_default_rate
  FROM doctors d
  WHERE d.id = p_doctor_id
  LIMIT 1;

  RETURN COALESCE(v_default_rate, 0);
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5. RLS policy for frontend anon/authenticated access
-- ----------------------------------------------------------------------------
ALTER TABLE doctor_treatment_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_full_access_doctor_treatment_commissions"
ON doctor_treatment_commissions;

CREATE POLICY "anon_full_access_doctor_treatment_commissions"
ON doctor_treatment_commissions
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

COMMIT;

-- ----------------------------------------------------------------------------
-- Verification
-- ----------------------------------------------------------------------------
SELECT
  'migration_ok' AS status,
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'doctor_treatment_commissions'
  ) AS has_table,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'doctor_treatment_commissions'
      AND column_name = 'updated_at'
  ) AS has_updated_at,
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'doctor_treatment_commissions'
      AND indexname = 'idx_doctor_treatment_commissions_doctor_id'
  ) AS has_doctor_id_index,
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'doctor_treatment_commissions'
      AND indexname = 'idx_doctor_treatment_commissions_treatment_id'
  ) AS has_treatment_id_index,
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'get_applicable_commission_rate'
  ) AS has_commission_rpc,
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'doctor_treatment_commissions'
      AND policyname = 'anon_full_access_doctor_treatment_commissions'
  ) AS has_rls_policy,
  (
    SELECT ccu.table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'doctor_treatment_commissions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'treatment_id'
    LIMIT 1
  ) AS treatment_id_references_table;
