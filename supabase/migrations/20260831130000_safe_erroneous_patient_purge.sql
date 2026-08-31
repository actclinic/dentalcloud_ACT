-- Removes a demonstrably erroneous patient only when no clinical or financial
-- record exists. The removed appointment/correction facts are retained here.

BEGIN;

CREATE TABLE IF NOT EXISTS public.erroneous_patient_purges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_patient_id UUID NOT NULL UNIQUE,
  patient_snapshot JSONB NOT NULL,
  appointment_snapshots JSONB NOT NULL,
  correction_snapshots JSONB NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) >= 10),
  purged_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  purged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erroneous_patient_purges_purged_at
  ON public.erroneous_patient_purges (purged_at DESC);

ALTER TABLE public.erroneous_patient_purges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.erroneous_patient_purges FROM PUBLIC, anon, authenticated;

-- Only the controlled purge function may remove an immutable correction.
CREATE OR REPLACE FUNCTION public.prevent_doctor_assignment_correction_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF current_setting('app.erroneous_patient_purge', true) = 'allowed' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Doctor assignment correction history is immutable.';
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_erroneous_patient(
  p_patient_id UUID,
  p_reason TEXT,
  p_purged_by_user_id UUID,
  p_staff_session_token UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_patient public.patients%ROWTYPE;
  v_purge_id UUID;
  v_appointments JSONB;
  v_corrections JSONB;
BEGIN
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Purge reason must be at least 10 characters' USING ERRCODE = '22023';
  END IF;

  SELECT patient.* INTO v_patient
  FROM public.patients AS patient
  JOIN public.users AS app_user ON app_user.id = p_purged_by_user_id
  JOIN public.staff_auth_sessions AS staff_session
    ON staff_session.user_id = app_user.id
   AND staff_session.session_token = p_staff_session_token
   AND staff_session.revoked_at IS NULL
   AND staff_session.expires_at > NOW()
  WHERE patient.id = p_patient_id
    AND app_user.role = 'admin'
  FOR UPDATE OF patient;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found, or an active admin session is required' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.treatments WHERE patient_id = v_patient.id)
     OR EXISTS (SELECT 1 FROM public.payments WHERE patient_id = v_patient.id)
     OR EXISTS (SELECT 1 FROM public.medicine_sales WHERE patient_id = v_patient.id)
     OR EXISTS (SELECT 1 FROM public.doctor_commission_entries WHERE patient_id = v_patient.id)
     OR EXISTS (SELECT 1 FROM public.audit_logs WHERE patient_id = v_patient.id)
     OR EXISTS (SELECT 1 FROM public.voided_payments WHERE patient_id = v_patient.id) THEN
    RAISE EXCEPTION 'Only patients without clinical, financial, commission, or audit records may be purged' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(appointment) ORDER BY appointment.date, appointment.time, appointment.id), '[]'::JSONB)
  INTO v_appointments
  FROM public.appointments AS appointment
  WHERE appointment.patient_id = v_patient.id;

  SELECT COALESCE(jsonb_agg(to_jsonb(correction) ORDER BY correction.corrected_at, correction.id), '[]'::JSONB)
  INTO v_corrections
  FROM public.doctor_assignment_corrections AS correction
  WHERE correction.patient_id = v_patient.id;

  INSERT INTO public.erroneous_patient_purges (
    original_patient_id, patient_snapshot, appointment_snapshots, correction_snapshots, reason, purged_by
  ) VALUES (
    v_patient.id, to_jsonb(v_patient), v_appointments, v_corrections, btrim(p_reason), p_purged_by_user_id
  ) RETURNING id INTO v_purge_id;

  PERFORM set_config('app.erroneous_patient_purge', 'allowed', true);
  DELETE FROM public.doctor_assignment_corrections WHERE patient_id = v_patient.id;
  DELETE FROM public.appointments WHERE patient_id = v_patient.id;
  DELETE FROM public.patients WHERE id = v_patient.id;

  RETURN v_purge_id;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_erroneous_patient(UUID, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_erroneous_patient(UUID, TEXT, UUID, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
