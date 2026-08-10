BEGIN;

DO $$
BEGIN
  IF to_regclass('public.appointments') IS NULL
     OR to_regclass('public.treatments') IS NULL
     OR to_regclass('public.audit_logs') IS NULL
     OR to_regclass('public.doctor_commission_entries') IS NULL
     OR to_regclass('public.pending_commission_recalculations') IS NULL
     OR to_regclass('public.staff_auth_sessions') IS NULL
     OR to_regprocedure('public.acknowledge_commission_recalculation(uuid,uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Doctor correction prerequisites are missing. Apply the staff-session, audit, and commission-ledger migrations first.';
  END IF;
END;
$$;

ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS appointment_id UUID;

ALTER TABLE public.treatments
  DROP CONSTRAINT IF EXISTS treatments_appointment_id_fkey;

ALTER TABLE public.treatments
  ADD CONSTRAINT treatments_appointment_id_fkey
  FOREIGN KEY (appointment_id)
  REFERENCES public.appointments(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_treatments_appointment_id
  ON public.treatments(appointment_id);

CREATE TABLE IF NOT EXISTS public.doctor_assignment_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  old_doctor_id UUID REFERENCES public.doctors(id) ON DELETE RESTRICT,
  new_doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  treatment_ids UUID[] NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 1000),
  corrected_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doctor_assignment_corrections_doctor_change_check
    CHECK (old_doctor_id IS DISTINCT FROM new_doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_doctor_assignment_corrections_appointment
  ON public.doctor_assignment_corrections(appointment_id, corrected_at DESC);

CREATE INDEX IF NOT EXISTS idx_doctor_assignment_corrections_patient
  ON public.doctor_assignment_corrections(patient_id, corrected_at DESC);

ALTER TABLE public.doctor_assignment_corrections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.prevent_doctor_assignment_correction_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'Doctor assignment correction history is immutable.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_doctor_assignment_correction_update
  ON public.doctor_assignment_corrections;
CREATE TRIGGER trg_prevent_doctor_assignment_correction_update
BEFORE UPDATE ON public.doctor_assignment_corrections
FOR EACH ROW EXECUTE FUNCTION public.prevent_doctor_assignment_correction_mutation();

DROP TRIGGER IF EXISTS trg_prevent_doctor_assignment_correction_delete
  ON public.doctor_assignment_corrections;
CREATE TRIGGER trg_prevent_doctor_assignment_correction_delete
BEFORE DELETE ON public.doctor_assignment_corrections
FOR EACH ROW EXECUTE FUNCTION public.prevent_doctor_assignment_correction_mutation();

REVOKE ALL ON public.doctor_assignment_corrections FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_doctor_assignment_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF current_setting('app.doctor_assignment_correction', true) IS DISTINCT FROM 'allowed' THEN
    RAISE EXCEPTION 'Use the administrator Correct Doctor workflow to change doctor ownership.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_appointment_doctor_assignment ON public.appointments;
CREATE TRIGGER trg_guard_appointment_doctor_assignment
BEFORE UPDATE OF doctor_id ON public.appointments
FOR EACH ROW
WHEN (OLD.doctor_id IS DISTINCT FROM NEW.doctor_id)
EXECUTE FUNCTION public.guard_doctor_assignment_columns();

DROP TRIGGER IF EXISTS trg_guard_treatment_doctor_assignment ON public.treatments;
CREATE TRIGGER trg_guard_treatment_doctor_assignment
BEFORE UPDATE OF doctor_id, appointment_id ON public.treatments
FOR EACH ROW
WHEN (
  OLD.doctor_id IS DISTINCT FROM NEW.doctor_id
  OR OLD.appointment_id IS DISTINCT FROM NEW.appointment_id
)
EXECUTE FUNCTION public.guard_doctor_assignment_columns();

CREATE OR REPLACE FUNCTION public.correct_doctor_assignment(
  p_appointment_id UUID,
  p_expected_old_doctor_id UUID,
  p_new_doctor_id UUID,
  p_treatment_ids UUID[],
  p_reason TEXT,
  p_admin_user_id UUID,
  p_session_token TEXT
)
RETURNS TABLE (
  correction_id UUID,
  patient_id UUID,
  request_token UUID,
  corrected_treatment_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_new_doctor public.doctors%ROWTYPE;
  v_treatment_ids UUID[] := COALESCE(p_treatment_ids, '{}'::UUID[]);
  v_unique_count INTEGER;
  v_matching_count INTEGER;
  v_correction_id UUID;
  v_request_token UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS u
    JOIN public.staff_auth_sessions AS s ON s.user_id = u.id
    WHERE u.id = p_admin_user_id
      AND u.role = 'admin'
      AND s.session_token::TEXT = btrim(COALESCE(p_session_token, ''))
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'A current administrator session is required.' USING ERRCODE = '42501';
  END IF;

  IF char_length(btrim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Correction reason must be at least 10 characters.';
  END IF;
  IF char_length(btrim(p_reason)) > 1000 THEN
    RAISE EXCEPTION 'Correction reason must be 1000 characters or fewer.';
  END IF;

  SELECT * INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment was not found.';
  END IF;
  IF v_appointment.patient_id IS NULL THEN
    RAISE EXCEPTION 'Doctor corrections require a registered-patient appointment.';
  END IF;
  IF v_appointment.doctor_id IS DISTINCT FROM p_expected_old_doctor_id THEN
    RAISE EXCEPTION 'The appointment doctor changed after this screen was opened. Refresh and review again.' USING ERRCODE = '40001';
  END IF;
  IF p_new_doctor_id IS NULL OR p_new_doctor_id IS NOT DISTINCT FROM v_appointment.doctor_id THEN
    RAISE EXCEPTION 'Choose a different doctor.';
  END IF;

  SELECT * INTO v_new_doctor
  FROM public.doctors
  WHERE id = p_new_doctor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The new doctor was not found.';
  END IF;
  IF v_new_doctor.location_id IS DISTINCT FROM v_appointment.location_id
     AND NOT EXISTS (
       SELECT 1 FROM public.doctor_locations AS dl
       WHERE dl.doctor_id = p_new_doctor_id
         AND dl.location_id = v_appointment.location_id
     ) THEN
    RAISE EXCEPTION 'The new doctor is not assigned to this branch.';
  END IF;

  SELECT COUNT(DISTINCT selected_id), COUNT(*)
  INTO v_unique_count, v_matching_count
  FROM unnest(v_treatment_ids) AS selected_id;
  IF v_unique_count <> v_matching_count THEN
    RAISE EXCEPTION 'Treatment selection contains duplicates.';
  END IF;

  IF v_unique_count > 0 THEN
    PERFORM 1
    FROM public.treatments
    WHERE id = ANY(v_treatment_ids)
    ORDER BY id
    FOR UPDATE;

    SELECT COUNT(*) INTO v_matching_count
    FROM public.treatments AS t
    WHERE t.id = ANY(v_treatment_ids)
      AND t.patient_id = v_appointment.patient_id
      AND t.location_id = v_appointment.location_id
      AND t.doctor_id IS NOT DISTINCT FROM v_appointment.doctor_id
      AND (t.appointment_id IS NULL OR t.appointment_id = v_appointment.id);

    IF v_matching_count <> v_unique_count THEN
      RAISE EXCEPTION 'One or more selected treatments no longer match this appointment, patient, branch, or old doctor.' USING ERRCODE = '40001';
    END IF;
  END IF;

  PERFORM set_config('app.doctor_assignment_correction', 'allowed', true);

  UPDATE public.appointments
  SET doctor_id = p_new_doctor_id
  WHERE id = v_appointment.id;

  IF v_unique_count > 0 THEN
    UPDATE public.treatments
    SET doctor_id = p_new_doctor_id,
        appointment_id = COALESCE(appointment_id, v_appointment.id),
        doctor_earnings = 0
    WHERE id = ANY(v_treatment_ids);

    UPDATE public.audit_logs
    SET doctor_id = p_new_doctor_id,
        updated_at = NOW()
    WHERE source_type = 'treatment'
      AND treatment_id = ANY(v_treatment_ids);

    DELETE FROM public.doctor_commission_entries
    WHERE treatment_id = ANY(v_treatment_ids);

    INSERT INTO public.pending_commission_recalculations(patient_id, request_token, requested_at)
    VALUES (v_appointment.patient_id, v_request_token, NOW())
    ON CONFLICT (patient_id) DO UPDATE
    SET request_token = EXCLUDED.request_token,
        requested_at = EXCLUDED.requested_at;
  END IF;

  UPDATE public.audit_logs
  SET doctor_id = p_new_doctor_id,
      updated_at = NOW()
  WHERE source_type = 'appointment'
    AND appointment_id = v_appointment.id;

  INSERT INTO public.doctor_assignment_corrections(
    appointment_id, patient_id, location_id, old_doctor_id, new_doctor_id,
    treatment_ids, reason, corrected_by
  ) VALUES (
    v_appointment.id, v_appointment.patient_id, v_appointment.location_id,
    v_appointment.doctor_id, p_new_doctor_id, v_treatment_ids,
    btrim(p_reason), p_admin_user_id
  ) RETURNING id INTO v_correction_id;

  RETURN QUERY SELECT v_correction_id, v_appointment.patient_id,
    CASE WHEN v_unique_count > 0 THEN v_request_token ELSE NULL END,
    v_unique_count;
END;
$$;

REVOKE ALL ON FUNCTION public.correct_doctor_assignment(UUID, UUID, UUID, UUID[], TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.correct_doctor_assignment(UUID, UUID, UUID, UUID[], TEXT, UUID, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
