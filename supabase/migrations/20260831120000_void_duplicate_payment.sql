-- Safely removes an accidentally duplicated payment while preserving an audit copy.
-- The payment, its dependent allocations, and its commission entries are deleted
-- together only after the patient's live balance has been restored.

BEGIN;

CREATE TABLE IF NOT EXISTS public.voided_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_payment_id UUID NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  payment_snapshot JSONB NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) >= 10),
  voided_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  voided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voided_payments_patient_id
  ON public.voided_payments (patient_id, voided_at DESC);

ALTER TABLE public.voided_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voided_payments FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.void_duplicate_payment(
  p_payment_id UUID,
  p_reason TEXT,
  p_voided_by_user_id UUID,
  p_staff_session_token UUID
)
RETURNS TABLE (patient_id UUID, new_balance NUMERIC(12,2))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_current_balance NUMERIC(12,2);
  v_payment_amount NUMERIC(12,2);
  v_snapshot JSONB;
BEGIN
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Void reason must be at least 10 characters' USING ERRCODE = '22023';
  END IF;

  SELECT payment.*
  INTO v_payment
  FROM public.payments AS payment
  JOIN public.users AS app_user ON app_user.id = p_voided_by_user_id
  JOIN public.staff_auth_sessions AS staff_session
    ON staff_session.user_id = app_user.id
   AND staff_session.session_token = p_staff_session_token
   AND staff_session.revoked_at IS NULL
   AND staff_session.expires_at > NOW()
  WHERE payment.id = p_payment_id
    AND app_user.role = 'admin'
  FOR UPDATE OF payment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found, or an active admin session is required' USING ERRCODE = '42501';
  END IF;

  SELECT balance
  INTO v_current_balance
  FROM public.patients
  WHERE id = v_payment.patient_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment patient not found';
  END IF;

  v_payment_amount := ROUND(COALESCE(v_payment.cleared_amount, v_payment.amount), 2);
  v_snapshot := jsonb_build_object(
    'payment', to_jsonb(v_payment),
    'allocations', COALESCE((
      SELECT jsonb_agg(to_jsonb(allocation) ORDER BY allocation.created_at, allocation.id)
      FROM public.payment_allocations AS allocation
      WHERE allocation.payment_id = v_payment.id
    ), '[]'::JSONB),
    'corrections', COALESCE((
      SELECT jsonb_agg(to_jsonb(correction) ORDER BY correction.edited_at, correction.id)
      FROM public.payment_corrections AS correction
      WHERE correction.payment_id = v_payment.id
    ), '[]'::JSONB)
  );

  INSERT INTO public.voided_payments (
    original_payment_id, patient_id, location_id, payment_snapshot, reason, voided_by
  ) VALUES (
    v_payment.id, v_payment.patient_id, v_payment.location_id, v_snapshot, btrim(p_reason), p_voided_by_user_id
  );

  UPDATE public.patients
  SET balance = ROUND(COALESCE(v_current_balance, 0) + v_payment_amount, 2)
  WHERE id = v_payment.patient_id
  RETURNING balance INTO new_balance;

  DELETE FROM public.payments WHERE id = v_payment.id;
  patient_id := v_payment.patient_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.void_duplicate_payment(UUID, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_duplicate_payment(UUID, TEXT, UUID, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
