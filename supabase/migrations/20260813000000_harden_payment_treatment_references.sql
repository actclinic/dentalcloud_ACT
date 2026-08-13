-- Validate itemized payment treatment references against authoritative rows.
-- Applies uniformly to single and split payments because both insert into payments.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pending_commission_recalculations') IS NULL THEN
    RAISE EXCEPTION 'Install the commission recalculation prerequisites before payment reference hardening';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_payment_receipt_reconciliation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_service_fee NUMERIC(12,2) := 0;
  v_treatment_total NUMERIC(12,2) := 0;
  v_medicine_total NUMERIC(12,2) := 0;
  v_captured_total NUMERIC(12,2) := 0;
  v_array_count INTEGER := 0;
  v_array_distinct_count INTEGER := 0;
  v_snapshot_count INTEGER := 0;
  v_snapshot_distinct_count INTEGER := 0;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT linked_id)
  INTO v_array_count, v_array_distinct_count
  FROM unnest(COALESCE(NEW.treatment_ids, ARRAY[]::UUID[])) AS linked_id;

  IF v_array_count <> v_array_distinct_count THEN
    RAISE EXCEPTION 'Payment contains duplicate treatment references' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(NEW.treatment_ids, ARRAY[]::UUID[])) AS linked_id
    LEFT JOIN public.treatments AS treatment ON treatment.id = linked_id
    WHERE treatment.id IS NULL
       OR treatment.patient_id IS DISTINCT FROM NEW.patient_id
       OR treatment.location_id IS DISTINCT FROM NEW.location_id
  ) THEN
    RAISE EXCEPTION 'Payment contains an invalid treatment reference' USING ERRCODE = '22023';
  END IF;

  -- Existing unmarked receipts remain compatible, but authoritative ownership is
  -- enforced for every payment regardless of client version.
  IF NEW.receipt_snapshot IS NULL
     OR COALESCE(NEW.receipt_snapshot #>> '{reconciliation,version}', '') <> '1' THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.receipt_snapshot -> 'treatments') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Payment receipt treatments must be an array' USING ERRCODE = '22023';
  END IF;

  BEGIN
    SELECT COUNT(*), COUNT(DISTINCT (item ->> 'id')::UUID)
    INTO v_snapshot_count, v_snapshot_distinct_count
    FROM jsonb_array_elements(NEW.receipt_snapshot -> 'treatments') AS item
    WHERE NULLIF(BTRIM(item ->> 'id'), '') IS NOT NULL;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Payment receipt contains an invalid treatment ID' USING ERRCODE = '22023';
  END;

  IF v_snapshot_count <> jsonb_array_length(NEW.receipt_snapshot -> 'treatments')
     OR v_snapshot_count <> v_snapshot_distinct_count THEN
    RAISE EXCEPTION 'Payment receipt contains missing or duplicate treatment IDs' USING ERRCODE = '22023';
  END IF;

  IF v_array_count <> v_snapshot_count
     OR EXISTS (
       SELECT 1
       FROM unnest(COALESCE(NEW.treatment_ids, ARRAY[]::UUID[])) AS linked_id
       WHERE NOT EXISTS (
         SELECT 1
         FROM jsonb_array_elements(NEW.receipt_snapshot -> 'treatments') AS item
         WHERE item ->> 'id' = linked_id::TEXT
       )
     ) THEN
    RAISE EXCEPTION 'Payment treatment links do not exactly match the receipt' USING ERRCODE = '22023';
  END IF;

  v_service_fee := ROUND(COALESCE(
    NULLIF(BTRIM(COALESCE(NEW.receipt_snapshot #>> '{payment,serviceFeeAmount}', '')), '')::NUMERIC,
    0
  ), 2);

  SELECT ROUND(COALESCE(SUM(NULLIF(BTRIM(item ->> 'finalCost'), '')::NUMERIC), 0), 2)
  INTO v_treatment_total
  FROM jsonb_array_elements(NEW.receipt_snapshot -> 'treatments') AS item;

  SELECT ROUND(COALESCE(SUM(NULLIF(BTRIM(item ->> 'totalPrice'), '')::NUMERIC), 0), 2)
  INTO v_medicine_total
  FROM jsonb_array_elements(COALESCE(NEW.receipt_snapshot -> 'medicines', '[]'::JSONB)) AS item;

  v_captured_total := ROUND(v_service_fee + v_treatment_total + v_medicine_total, 2);
  IF ROUND(COALESCE(NEW.amount, 0), 2) > v_captured_total THEN
    RAISE EXCEPTION 'Payment details are missing % of billable items',
      ROUND(NEW.amount - v_captured_total, 2)
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_payment_receipt_reconciliation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_payment_receipt_reconciliation ON public.payments;
CREATE TRIGGER guard_payment_receipt_reconciliation
BEFORE INSERT OR UPDATE OF patient_id, location_id, treatment_ids, receipt_snapshot, amount
ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.guard_payment_receipt_reconciliation();

CREATE OR REPLACE FUNCTION public.mark_payment_commission_recalculation_pending(
  p_payment_id UUID,
  p_patient_id UUID,
  p_request_token UUID,
  p_staff_user_id UUID,
  p_staff_session_token UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_request_token IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.payments AS payment
    WHERE payment.id = p_payment_id
      AND payment.patient_id = p_patient_id
  ) THEN
    RAISE EXCEPTION 'A valid saved payment is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.payments AS payment
    JOIN public.users AS app_user ON app_user.id = p_staff_user_id
    JOIN public.staff_auth_sessions AS staff_session
      ON staff_session.user_id = app_user.id
     AND staff_session.session_token = p_staff_session_token
     AND staff_session.revoked_at IS NULL
     AND staff_session.expires_at > NOW()
    WHERE payment.id = p_payment_id
      AND (
        app_user.role = 'admin'
        OR (
          app_user.role = 'normal'
          AND app_user.doctor_id IS NULL
          AND jsonb_typeof(app_user.allowed_tabs) = 'array'
          AND app_user.allowed_tabs ? 'finance'
          AND (app_user.location_id IS NULL OR app_user.location_id = payment.location_id)
        )
      )
  ) THEN
    RAISE EXCEPTION 'A current staff session with Finance permission is required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.pending_commission_recalculations (
    patient_id, request_token, requested_at
  ) VALUES (
    p_patient_id, p_request_token, NOW()
  )
  ON CONFLICT (patient_id) DO UPDATE
  SET request_token = EXCLUDED.request_token,
      requested_at = EXCLUDED.requested_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_payment_commission_recalculation_pending(UUID, UUID, UUID, UUID, UUID)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_payment_commission_recalculation_pending(UUID, UUID, UUID, UUID, UUID)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.clear_payment_commission_recalculation_pending(
  p_payment_id UUID,
  p_patient_id UUID,
  p_staff_user_id UUID,
  p_staff_session_token UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.payments AS payment
    JOIN public.users AS app_user ON app_user.id = p_staff_user_id
    JOIN public.staff_auth_sessions AS staff_session
      ON staff_session.user_id = app_user.id
     AND staff_session.session_token = p_staff_session_token
     AND staff_session.revoked_at IS NULL
     AND staff_session.expires_at > NOW()
    WHERE payment.id = p_payment_id
      AND payment.patient_id = p_patient_id
      AND (
        app_user.role = 'admin'
        OR (
          app_user.role = 'normal'
          AND app_user.doctor_id IS NULL
          AND jsonb_typeof(app_user.allowed_tabs) = 'array'
          AND app_user.allowed_tabs ? 'finance'
          AND (app_user.location_id IS NULL OR app_user.location_id = payment.location_id)
        )
      )
  ) THEN
    RAISE EXCEPTION 'A current staff session with Finance permission is required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.pending_commission_recalculations
  WHERE patient_id = p_patient_id;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_payment_commission_recalculation_pending(UUID, UUID, UUID, UUID)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_payment_commission_recalculation_pending(UUID, UUID, UUID, UUID)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;