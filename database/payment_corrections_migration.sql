BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  old_amount NUMERIC(12,2) NOT NULL CHECK (old_amount > 0),
  new_amount NUMERIC(12,2) NOT NULL CHECK (new_amount > 0),
  old_method TEXT NOT NULL,
  new_method TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 10),
  edited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_corrections_payment_id
  ON public.payment_corrections(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_corrections_payment_id_edited_at
  ON public.payment_corrections(payment_id, edited_at DESC);

ALTER TABLE public.payment_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_corrections FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.role = 'admin'
  );
$$;

DROP POLICY IF EXISTS payment_corrections_admin_select ON public.payment_corrections;
CREATE POLICY payment_corrections_admin_select
ON public.payment_corrections
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS payment_corrections_admin_insert ON public.payment_corrections;
CREATE POLICY payment_corrections_admin_insert
ON public.payment_corrections
FOR INSERT
TO anon, authenticated
WITH CHECK (
  public.is_admin_user(edited_by)
);

CREATE OR REPLACE FUNCTION public.prevent_payment_correction_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'payment_corrections is immutable; update/delete is not allowed';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_payment_correction_update ON public.payment_corrections;
CREATE TRIGGER trg_prevent_payment_correction_update
BEFORE UPDATE ON public.payment_corrections
FOR EACH ROW
EXECUTE FUNCTION public.prevent_payment_correction_mutation();

DROP TRIGGER IF EXISTS trg_prevent_payment_correction_delete ON public.payment_corrections;
CREATE TRIGGER trg_prevent_payment_correction_delete
BEFORE DELETE ON public.payment_corrections
FOR EACH ROW
EXECUTE FUNCTION public.prevent_payment_correction_mutation();

CREATE OR REPLACE FUNCTION public.correct_payment_record(
  p_payment_id UUID,
  p_new_amount NUMERIC(12,2),
  p_new_method TEXT,
  p_reason TEXT,
  p_edited_by_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_new_amount NUMERIC(12,2);
  v_new_method TEXT;
  v_delta NUMERIC(12,2);
  v_new_remaining NUMERIC(12,2);
  v_new_status TEXT;
  v_allowed_methods TEXT[] := ARRAY[
    'KPAY',
    'WAVEPAY',
    'CASH',
    'MMQR',
    'DEBIT_CARD',
    'CREDIT_CARD',
    'AYA_PAY',
    'UAB_PAY'
  ];
BEGIN
  IF p_edited_by_user_id IS NULL OR NOT public.is_admin_user(p_edited_by_user_id) THEN
    RAISE EXCEPTION 'Only admins can correct payments'
      USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR char_length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Correction reason must be at least 10 characters';
  END IF;

  v_new_amount := round(p_new_amount::NUMERIC, 2);
  v_new_method := upper(trim(p_new_method));

  IF v_new_amount <= 0 THEN
    RAISE EXCEPTION 'New amount must be greater than 0';
  END IF;

  IF NOT (v_new_method = ANY(v_allowed_methods)) THEN
    RAISE EXCEPTION 'Invalid payment method: %', v_new_method;
  END IF;

  SELECT *
  INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_new_amount > v_payment.balance_before THEN
    RAISE EXCEPTION 'Corrected amount cannot be greater than balance_before (%)', v_payment.balance_before;
  END IF;

  v_delta := v_new_amount - COALESCE(v_payment.cleared_amount, v_payment.amount);
  v_new_remaining := greatest(v_payment.balance_before - v_new_amount, 0);
  v_new_status := CASE
    WHEN v_new_remaining = 0 THEN 'FULL'
    ELSE 'PARTIAL'
  END;

  UPDATE public.patients
  SET balance = greatest(balance - v_delta, 0)
  WHERE id = v_payment.patient_id;

  UPDATE public.payments
  SET
    amount = v_new_amount,
    cleared_amount = v_new_amount,
    remaining_balance = v_new_remaining,
    payment_status = v_new_status,
    payment_method = v_new_method,
    receipt_snapshot = CASE
      WHEN receipt_snapshot IS NULL THEN NULL
      ELSE jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              receipt_snapshot,
              '{payment,amountPaid}',
              to_jsonb(v_new_amount),
              true
            ),
            '{payment,method}',
            to_jsonb(v_new_method),
            true
          ),
          '{payment,balanceAfter}',
          to_jsonb(v_new_remaining),
          true
        ),
        '{payment,status}',
        to_jsonb(v_new_status),
        true
      )
    END
  WHERE id = v_payment.id;

  INSERT INTO public.payment_corrections (
    payment_id,
    old_amount,
    new_amount,
    old_method,
    new_method,
    reason,
    edited_by
  )
  VALUES (
    v_payment.id,
    v_payment.amount,
    v_new_amount,
    v_payment.payment_method,
    v_new_method,
    trim(p_reason),
    p_edited_by_user_id
  );

  RETURN v_payment.id;
END;
$$;

REVOKE ALL ON FUNCTION public.correct_payment_record(UUID, NUMERIC, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.correct_payment_record(UUID, NUMERIC, TEXT, TEXT, UUID) TO anon, authenticated;

COMMIT;
