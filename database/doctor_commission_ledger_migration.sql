-- ============================================================================
-- MIGRATION: Payment-based doctor commission ledger
-- ============================================================================
-- Safe to run multiple times.
-- Run this file in the Supabase SQL editor before deploying the matching app.

BEGIN;

ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS treatment_type_id UUID;

ALTER TABLE public.treatments
  DROP CONSTRAINT IF EXISTS treatments_treatment_type_id_fkey;

ALTER TABLE public.treatments
  ADD CONSTRAINT treatments_treatment_type_id_fkey
  FOREIGN KEY (treatment_type_id)
  REFERENCES public.treatment_types(id)
  ON DELETE SET NULL;

-- Best-effort backfill for records created before treatment_type_id was stored.
-- If names are duplicated inside a branch, the deterministic lowest UUID wins.
UPDATE public.treatments AS treatment
SET treatment_type_id = (
  SELECT treatment_type.id
  FROM public.treatment_types AS treatment_type
  WHERE treatment_type.location_id = treatment.location_id
    AND LOWER(TRIM(treatment_type.name)) = LOWER(TRIM(treatment.description))
  ORDER BY treatment_type.id
  LIMIT 1
)
WHERE treatment.treatment_type_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.treatment_types AS treatment_type
    WHERE treatment_type.location_id = treatment.location_id
      AND LOWER(TRIM(treatment_type.name)) = LOWER(TRIM(treatment.description))
  );

CREATE INDEX IF NOT EXISTS idx_treatments_treatment_type_id
  ON public.treatments (treatment_type_id);

CREATE TABLE IF NOT EXISTS public.doctor_commission_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  treatment_date DATE NOT NULL,
  visit_key TEXT NOT NULL,
  calculation_mode TEXT NOT NULL,
  allocated_payment DECIMAL(12,2) NOT NULL DEFAULT 0,
  material_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission_base DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doctor_commission_entries_payment_treatment_key
    UNIQUE (payment_id, treatment_id),
  CONSTRAINT doctor_commission_entries_mode_check
    CHECK (calculation_mode IN ('percentage', 'flat_visit')),
  CONSTRAINT doctor_commission_entries_amounts_check
    CHECK (
      allocated_payment >= 0 AND
      material_deduction >= 0 AND
      commission_base >= 0 AND
      commission_rate >= 0 AND
      earnings >= 0
    ),
  CONSTRAINT doctor_commission_entries_percentage_rate_check
    CHECK (calculation_mode <> 'percentage' OR commission_rate <= 100)
);

CREATE INDEX IF NOT EXISTS idx_doctor_commission_entries_doctor_payment_date
  ON public.doctor_commission_entries (doctor_id, payment_date);

CREATE INDEX IF NOT EXISTS idx_doctor_commission_entries_treatment_id
  ON public.doctor_commission_entries (treatment_id);

CREATE INDEX IF NOT EXISTS idx_doctor_commission_entries_patient_id
  ON public.doctor_commission_entries (patient_id);

CREATE INDEX IF NOT EXISTS idx_doctor_commission_entries_visit_key
  ON public.doctor_commission_entries (visit_key);

CREATE OR REPLACE FUNCTION public.set_doctor_commission_entries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_doctor_commission_entries_updated_at
  ON public.doctor_commission_entries;

CREATE TRIGGER trg_doctor_commission_entries_updated_at
BEFORE UPDATE ON public.doctor_commission_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_doctor_commission_entries_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_commission_entries TO anon, authenticated, service_role;

ALTER TABLE public.doctor_commission_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_access_doctor_commission_entries"
  ON public.doctor_commission_entries;

-- This project currently uses its own users table with the anon Data API role.
-- Match the existing application access model; authorization tightening should be
-- performed for the whole application rather than only this dependent table.
CREATE POLICY "app_access_doctor_commission_entries"
ON public.doctor_commission_entries
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

COMMIT;

-- Make the newly created/granted relation visible to PostgREST immediately.
-- This is especially important on production projects where the app may be
-- deployed as soon as this idempotent migration finishes.
NOTIFY pgrst, 'reload schema';

SELECT
  'migration_ok' AS status,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'treatments'
      AND column_name = 'treatment_type_id'
  ) AS has_treatment_type_id,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'doctor_commission_entries'
  ) AS has_commission_ledger,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'doctor_commission_entries'
      AND policyname = 'app_access_doctor_commission_entries'
  ) AS has_rls_policy;
