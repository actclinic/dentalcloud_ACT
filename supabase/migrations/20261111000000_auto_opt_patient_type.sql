-- Opt-in, event-driven conversion. No backfill and no changes to visit history.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Large indexes must be prepared separately with
-- database/auto_opt_patient_type_indexes.sql in autocommit mode.
DO $$
DECLARE v_table TEXT; v_index TEXT; v_predicate TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['appointments', 'treatments'] LOOP
    v_index := 'idx_' || v_table || '_auto_opt_visit';
    SELECT pg_get_expr(i.indpred, i.indrelid) INTO v_predicate
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_am am ON am.oid = c.relam
    WHERE i.indexrelid = to_regclass('public.' || v_index)
      AND i.indrelid = to_regclass('public.' || v_table)
      AND i.indisvalid AND i.indisready AND am.amname = 'btree'
      AND i.indnkeyatts = 2 AND i.indexprs IS NULL
      AND pg_get_indexdef(i.indexrelid, 1, TRUE) = 'patient_id'
      AND pg_get_indexdef(i.indexrelid, 2, TRUE) = 'date';
    IF NOT FOUND OR (v_table = 'treatments' AND v_predicate IS NOT NULL)
      OR (v_table = 'appointments' AND v_predicate IS DISTINCT FROM '((status)::text = ''Completed''::text)') THEN
      RAISE EXCEPTION 'Missing, invalid or unexpected index %. Run and verify database/auto_opt_patient_type_indexes.sql first.', v_index;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS auto_opt_patient_type_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS auto_opt_clinical_timezone TEXT NOT NULL DEFAULT 'Asia/Yangon';

CREATE OR REPLACE FUNCTION public.auto_opt_patient_type_on_visit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type TEXT;
  v_enabled BOOLEAN;
  v_timezone TEXT;
BEGIN
  IF TG_TABLE_NAME = 'appointments' THEN
    IF NEW.status IS DISTINCT FROM 'Completed' THEN RETURN NEW; END IF;
    -- Editing an already-completed visit is not a new attendance event.
    IF TG_OP = 'UPDATE' AND OLD.status = 'Completed' THEN RETURN NEW; END IF;
  END IF;

  SELECT auto_opt_patient_type_enabled, auto_opt_clinical_timezone
  INTO v_enabled, v_timezone
  FROM public.app_settings
  WHERE id = 1;
  IF NOT COALESCE(v_enabled, FALSE) THEN RETURN NEW; END IF;

  -- Only today's clinic event can convert; historical/future entry cannot.
  IF NEW.patient_id IS NULL
     OR NEW.date IS DISTINCT FROM (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::DATE THEN
    RETURN NEW;
  END IF;

  -- Serialize only this patient and remain compatible with FK KEY SHARE locks.
  SELECT patient_type INTO v_type
  FROM public.patients
  WHERE id = NEW.patient_id
  FOR NO KEY UPDATE;
  IF v_type IS NULL OR v_type NOT IN ('ONP', 'RNP') THEN RETURN NEW; END IF;

  -- Require a real visit on a strictly earlier calendar day.
  IF EXISTS (
       SELECT 1 FROM public.appointments
       WHERE patient_id = NEW.patient_id
         AND status = 'Completed'
         AND date < NEW.date
     ) OR EXISTS (
       SELECT 1 FROM public.treatments
       WHERE patient_id = NEW.patient_id
         AND date < NEW.date
     ) THEN
    UPDATE public.patients
    SET patient_type = CASE v_type WHEN 'ONP' THEN 'OPT(ONP)' ELSE 'OPT(RNP)' END
    WHERE id = NEW.patient_id AND patient_type = v_type;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_opt_patient_type_on_visit() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_auto_opt_appointment_visit ON public.appointments;
CREATE TRIGGER trg_auto_opt_appointment_visit
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.auto_opt_patient_type_on_visit();

DROP TRIGGER IF EXISTS trg_auto_opt_treatment_visit ON public.treatments;
CREATE TRIGGER trg_auto_opt_treatment_visit
  AFTER INSERT ON public.treatments
  FOR EACH ROW EXECUTE FUNCTION public.auto_opt_patient_type_on_visit();

-- Prevent stale Auto ONP clients from reverting either OPT classification.
CREATE OR REPLACE FUNCTION public.preserve_opt_patient_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.patient_type IN ('OPT(ONP)', 'OPT(RNP)') AND NEW.patient_type = 'ONP' THEN
    NEW.patient_type := OLD.patient_type;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.preserve_opt_patient_type() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_preserve_opt_patient_type ON public.patients;
CREATE TRIGGER trg_preserve_opt_patient_type
  BEFORE UPDATE OF patient_type ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.preserve_opt_patient_type();

-- Keep legacy Auto ONP bounded and exclude protected OPT types.
CREATE OR REPLACE FUNCTION public.apply_auto_onp_patient_type(p_location_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE v_updated_count INTEGER := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(
    hashtextextended('apply_auto_onp_patient_type:global-maintenance', 0)
  ) THEN RETURN 0; END IF;

  IF NOT COALESCE((
    SELECT auto_onp_patient_type_enabled
    FROM public.app_settings
    WHERE id = 1
  ), FALSE) THEN
    RETURN 0;
  END IF;

  WITH eligible AS MATERIALIZED (
    SELECT id
    FROM public.patients
    WHERE created_at <= NOW() - INTERVAL '1 month'
      AND (patient_type IS NULL OR patient_type NOT IN ('ONP', 'OPT(ONP)', 'OPT(RNP)'))
      AND (p_location_id IS NULL OR location_id = p_location_id)
    LIMIT 200
    FOR NO KEY UPDATE SKIP LOCKED
  )
  UPDATE public.patients patient
  SET patient_type = 'ONP'
  FROM eligible
  WHERE patient.id = eligible.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_auto_onp_patient_type(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_auto_onp_patient_type(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
