-- ============================================================================
-- SPLIT / MIXED PAYMENT ALLOCATIONS
-- Production rollout order: run payment_corrections_migration.sql first, then
-- this migration, before deploying the matching UI.
-- One payments row remains the balance/receipt event; child rows describe tender.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.payment_corrections') IS NULL
     OR to_regprocedure('public.is_admin_user(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Install database/payment_corrections_migration.sql before split payments';
  END IF;
END;
$$;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN (
    'KPAY', 'WAVEPAY', 'CASH', 'MMQR', 'DEBIT_CARD', 'CREDIT_CARD',
    'AYA_PAY', 'UAB_PAY', 'MIXED'
  ));

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN (
    'KPAY', 'WAVEPAY', 'CASH', 'MMQR', 'DEBIT_CARD', 'CREDIT_CARD',
    'AYA_PAY', 'UAB_PAY'
  )),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_allocations_payment_method_key UNIQUE (payment_id, payment_method),
  CONSTRAINT payment_allocations_reference_length_check CHECK (reference IS NULL OR char_length(reference) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id
  ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_method
  ON public.payment_allocations(payment_method);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_allocations_read ON public.payment_allocations;
CREATE POLICY payment_allocations_read
  ON public.payment_allocations
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON TABLE public.payment_allocations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.payment_allocations TO anon, authenticated;

INSERT INTO public.payment_allocations (payment_id, payment_method, amount)
SELECT p.id, p.payment_method, COALESCE(p.cleared_amount, p.amount)
FROM public.payments AS p
WHERE p.payment_method <> 'MIXED'
  AND COALESCE(p.cleared_amount, p.amount) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_allocations AS a WHERE a.payment_id = p.id
  )
ON CONFLICT (payment_id, payment_method) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_legacy_payment_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.payment_method <> 'MIXED' THEN
    INSERT INTO public.payment_allocations (payment_id, payment_method, amount)
    VALUES (NEW.id, NEW.payment_method, COALESCE(NEW.cleared_amount, NEW.amount))
    ON CONFLICT (payment_id, payment_method) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_legacy_payment_allocation ON public.payments;
CREATE TRIGGER trg_create_legacy_payment_allocation
AFTER INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.create_legacy_payment_allocation();

CREATE OR REPLACE FUNCTION public.sync_legacy_payment_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.payment_method <> 'MIXED' THEN
    DELETE FROM public.payment_allocations WHERE payment_id = NEW.id;
    INSERT INTO public.payment_allocations (payment_id, payment_method, amount)
    VALUES (NEW.id, NEW.payment_method, COALESCE(NEW.cleared_amount, NEW.amount));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_legacy_payment_allocation ON public.payments;
CREATE TRIGGER trg_sync_legacy_payment_allocation
AFTER UPDATE OF amount, cleared_amount, payment_method ON public.payments
FOR EACH ROW
WHEN (NEW.payment_method <> 'MIXED')
EXECUTE FUNCTION public.sync_legacy_payment_allocation();

ALTER TABLE public.payment_corrections
  ADD COLUMN IF NOT EXISTS old_allocations JSONB,
  ADD COLUMN IF NOT EXISTS new_allocations JSONB;

CREATE OR REPLACE FUNCTION public.assert_payment_allocation_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment_id UUID;
  v_payment public.payments%ROWTYPE;
  v_count INTEGER;
  v_total NUMERIC(12,2);
  v_only_method TEXT;
BEGIN
  IF TG_TABLE_NAME = 'payments' THEN
    v_payment_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_payment_id := COALESCE(NEW.payment_id, OLD.payment_id);
  END IF;
  SELECT * INTO v_payment FROM public.payments WHERE id = v_payment_id;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT count(*), COALESCE(sum(amount), 0), min(payment_method)
  INTO v_count, v_total, v_only_method
  FROM public.payment_allocations
  WHERE payment_id = v_payment_id;

  IF v_count = 0 OR round(v_total, 2) <> round(COALESCE(v_payment.cleared_amount, v_payment.amount), 2) THEN
    RAISE EXCEPTION 'Payment allocation total (%) must equal payment amount (%)', v_total, COALESCE(v_payment.cleared_amount, v_payment.amount);
  END IF;
  IF v_count = 1 AND v_payment.payment_method <> v_only_method THEN
    RAISE EXCEPTION 'Single allocation method must match payment header';
  END IF;
  IF v_count > 1 AND v_payment.payment_method <> 'MIXED' THEN
    RAISE EXCEPTION 'Multiple allocations require MIXED payment header';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_payment_allocation_from_allocation ON public.payment_allocations;
CREATE CONSTRAINT TRIGGER trg_assert_payment_allocation_from_allocation
AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_payment_allocation_total();

DROP TRIGGER IF EXISTS trg_assert_payment_allocation_from_payment ON public.payments;
CREATE CONSTRAINT TRIGGER trg_assert_payment_allocation_from_payment
AFTER INSERT OR UPDATE OF amount, cleared_amount, payment_method ON public.payments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_payment_allocation_total();

CREATE OR REPLACE FUNCTION public.process_patient_split_payment(
  p_patient_id UUID,
  p_amount NUMERIC,
  p_allocations JSONB,
  p_treatment_ids UUID[] DEFAULT '{}',
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_receipt_snapshot JSONB DEFAULT NULL,
  p_submission_key TEXT DEFAULT NULL,
  p_created_by_user_id UUID DEFAULT NULL,
  p_created_by_user_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, location_id UUID, patient_id UUID, patient_name TEXT,
  amount NUMERIC, original_amount NUMERIC, cleared_amount NUMERIC,
  balance_before NUMERIC, remaining_balance NUMERIC,
  payment_method VARCHAR, payment_status VARCHAR, treatment_ids UUID[],
  receipt_number VARCHAR, payment_date DATE, receipt_snapshot JSONB,
  created_by_user_id UUID, created_by_user_name VARCHAR, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_patient public.patients%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_amount NUMERIC(12,2) := round(COALESCE(p_amount, 0), 2);
  v_balance_before NUMERIC(12,2);
  v_submission_key TEXT := NULLIF(btrim(COALESCE(p_submission_key, '')), '');
  v_service_fee_amount NUMERIC(12,2) := round(COALESCE(NULLIF(btrim(COALESCE(p_receipt_snapshot #>> '{payment,serviceFeeAmount}', '')), ''), '0')::NUMERIC, 2);
  v_created_by_user_id UUID;
  v_allocation_count INTEGER;
  v_allocation_total NUMERIC(12,2);
BEGIN
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than 0'; END IF;
  IF v_service_fee_amount < 0 THEN RAISE EXCEPTION 'Service fee amount cannot be negative'; END IF;
  IF jsonb_typeof(p_allocations) <> 'array' OR jsonb_array_length(p_allocations) < 2 THEN
    RAISE EXCEPTION 'A split payment requires at least two allocations';
  END IF;

  IF v_submission_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_submission_key, 0));
  END IF;

  SELECT * INTO v_patient
  FROM public.patients
  WHERE patients.id = p_patient_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Patient not found'; END IF;

  IF v_submission_key IS NOT NULL THEN
    SELECT * INTO v_payment FROM public.payments WHERE submission_key = v_submission_key;
    IF FOUND THEN
      IF v_payment.patient_id <> p_patient_id
         OR round(v_payment.amount, 2) <> v_amount
         OR v_payment.payment_method <> 'MIXED'
         OR v_payment.payment_date <> COALESCE(p_payment_date, CURRENT_DATE)
         OR v_payment.treatment_ids <> COALESCE(p_treatment_ids, '{}') THEN
        RAISE EXCEPTION 'Submission key was already used for a different payment';
      END IF;
      IF EXISTS (
        WITH requested AS (
          SELECT upper(btrim(item->>'method')) AS method,
            round((item->>'amount')::NUMERIC, 2) AS amount,
            NULLIF(btrim(item->>'reference'), '') AS reference
          FROM jsonb_array_elements(p_allocations) AS item
        ), stored AS (
          SELECT payment_method AS method, amount, reference FROM public.payment_allocations WHERE payment_id = v_payment.id
        )
        (SELECT * FROM requested EXCEPT SELECT * FROM stored)
        UNION ALL
        (SELECT * FROM stored EXCEPT SELECT * FROM requested)
      ) THEN
        RAISE EXCEPTION 'Submission key was already used with different allocations';
      END IF;
      RETURN QUERY SELECT v_payment.id, v_payment.location_id, v_payment.patient_id, v_patient.name::TEXT,
        v_payment.amount, v_payment.original_amount, v_payment.cleared_amount, v_payment.balance_before,
        v_payment.remaining_balance, v_payment.payment_method, v_payment.payment_status, v_payment.treatment_ids,
        v_payment.receipt_number, v_payment.payment_date, v_payment.receipt_snapshot,
        v_payment.created_by_user_id, v_payment.created_by_user_name, v_payment.created_at;
      RETURN;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_allocations) AS item
    WHERE upper(btrim(item->>'method')) NOT IN ('KPAY','WAVEPAY','CASH','MMQR','DEBIT_CARD','CREDIT_CARD','AYA_PAY','UAB_PAY')
      OR COALESCE((item->>'amount')::NUMERIC, 0) <= 0
      OR char_length(COALESCE(item->>'reference', '')) > 200
  ) THEN RAISE EXCEPTION 'Invalid payment allocation'; END IF;

  SELECT count(*), round(sum((item->>'amount')::NUMERIC), 2)
  INTO v_allocation_count, v_allocation_total
  FROM jsonb_array_elements(p_allocations) AS item;
  IF v_allocation_count <> (SELECT count(DISTINCT upper(btrim(item->>'method'))) FROM jsonb_array_elements(p_allocations) AS item) THEN
    RAISE EXCEPTION 'Each payment method can only be used once';
  END IF;
  IF v_allocation_total <> v_amount THEN RAISE EXCEPTION 'Payment allocations must exactly equal payment amount'; END IF;
  IF (COALESCE(v_patient.balance, 0) + v_service_fee_amount) <= 0 THEN RAISE EXCEPTION 'Patient has no outstanding balance'; END IF;
  IF v_amount > (COALESCE(v_patient.balance, 0) + v_service_fee_amount) THEN RAISE EXCEPTION 'Payment amount cannot exceed outstanding balance'; END IF;

  v_balance_before := round(COALESCE(v_patient.balance, 0) + v_service_fee_amount, 2);
  SELECT users.id INTO v_created_by_user_id FROM public.users WHERE users.id = p_created_by_user_id;
  UPDATE public.patients SET balance = round(v_balance_before - v_amount, 2)
  WHERE patients.id = p_patient_id RETURNING * INTO v_patient;

  INSERT INTO public.payments (
    location_id, patient_id, amount, original_amount, cleared_amount, balance_before, remaining_balance,
    payment_method, payment_status, treatment_ids, payment_date, receipt_snapshot, submission_key,
    created_by_user_id, created_by_user_name
  ) VALUES (
    v_patient.location_id, v_patient.id, v_amount, v_amount, v_amount, v_balance_before, COALESCE(v_patient.balance, 0),
    'MIXED', CASE WHEN COALESCE(v_patient.balance, 0) = 0 THEN 'FULL' ELSE 'PARTIAL' END,
    COALESCE(p_treatment_ids, '{}'), COALESCE(p_payment_date, CURRENT_DATE), p_receipt_snapshot,
    v_submission_key, v_created_by_user_id, NULLIF(btrim(COALESCE(p_created_by_user_name, '')), '')
  ) RETURNING * INTO v_payment;

  INSERT INTO public.payment_allocations (payment_id, payment_method, amount, reference)
  SELECT v_payment.id, upper(btrim(item->>'method')), round((item->>'amount')::NUMERIC, 2), NULLIF(btrim(item->>'reference'), '')
  FROM jsonb_array_elements(p_allocations) AS item;

  RETURN QUERY SELECT v_payment.id, v_payment.location_id, v_payment.patient_id, v_patient.name::TEXT,
    v_payment.amount, v_payment.original_amount, v_payment.cleared_amount, v_payment.balance_before,
    v_payment.remaining_balance, v_payment.payment_method, v_payment.payment_status, v_payment.treatment_ids,
    v_payment.receipt_number, v_payment.payment_date, v_payment.receipt_snapshot,
    v_payment.created_by_user_id, v_payment.created_by_user_name, v_payment.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.process_patient_split_payment(UUID, NUMERIC, JSONB, UUID[], DATE, JSONB, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_patient_split_payment(UUID, NUMERIC, JSONB, UUID[], DATE, JSONB, TEXT, UUID, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.correct_split_payment_record(
  p_payment_id UUID,
  p_new_amount NUMERIC,
  p_new_allocations JSONB,
  p_reason TEXT,
  p_edited_by_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_new_amount NUMERIC(12,2) := round(COALESCE(p_new_amount, 0), 2);
  v_old_amount NUMERIC(12,2);
  v_delta NUMERIC(12,2);
  v_new_remaining NUMERIC(12,2);
  v_patient_balance NUMERIC(12,2);
  v_count INTEGER;
  v_total NUMERIC(12,2);
  v_old_allocations JSONB;
BEGIN
  IF p_edited_by_user_id IS NULL OR NOT public.is_admin_user(p_edited_by_user_id) THEN
    RAISE EXCEPTION 'Only admins can correct payments' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 10 THEN RAISE EXCEPTION 'Correction reason must be at least 10 characters'; END IF;
  IF v_new_amount <= 0 THEN RAISE EXCEPTION 'New amount must be greater than 0'; END IF;
  IF jsonb_typeof(p_new_allocations) <> 'array' OR jsonb_array_length(p_new_allocations) < 2 THEN
    RAISE EXCEPTION 'A split payment requires at least two allocations';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_new_allocations) AS item
    WHERE upper(btrim(item->>'method')) NOT IN ('KPAY','WAVEPAY','CASH','MMQR','DEBIT_CARD','CREDIT_CARD','AYA_PAY','UAB_PAY')
      OR COALESCE((item->>'amount')::NUMERIC, 0) <= 0
      OR char_length(COALESCE(item->>'reference', '')) > 200
  ) THEN RAISE EXCEPTION 'Invalid payment allocation'; END IF;
  SELECT count(*), round(sum((item->>'amount')::NUMERIC), 2)
  INTO v_count, v_total FROM jsonb_array_elements(p_new_allocations) AS item;
  IF v_count <> (SELECT count(DISTINCT upper(btrim(item->>'method'))) FROM jsonb_array_elements(p_new_allocations) AS item) THEN
    RAISE EXCEPTION 'Each payment method can only be used once';
  END IF;
  IF v_total <> v_new_amount THEN RAISE EXCEPTION 'Payment allocations must exactly equal payment amount'; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  v_old_amount := round(COALESCE(v_payment.cleared_amount, v_payment.amount), 2);
  IF v_new_amount > v_payment.balance_before THEN RAISE EXCEPTION 'Corrected amount cannot exceed balance before'; END IF;
  SELECT balance INTO v_patient_balance FROM public.patients WHERE id = v_payment.patient_id FOR UPDATE;
  v_delta := v_new_amount - v_old_amount;
  IF round(v_patient_balance - v_delta, 2) < 0 THEN RAISE EXCEPTION 'Correction would make patient balance negative'; END IF;
  v_new_remaining := round(v_payment.balance_before - v_new_amount, 2);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('method', payment_method, 'amount', amount, 'reference', reference) ORDER BY payment_method), '[]'::JSONB)
  INTO v_old_allocations FROM public.payment_allocations WHERE payment_id = v_payment.id;

  UPDATE public.patients SET balance = round(v_patient_balance - v_delta, 2) WHERE id = v_payment.patient_id;
  DELETE FROM public.payment_allocations WHERE payment_id = v_payment.id;
  UPDATE public.payments SET
    amount = v_new_amount,
    cleared_amount = v_new_amount,
    remaining_balance = v_new_remaining,
    payment_method = 'MIXED',
    payment_status = CASE WHEN v_new_remaining = 0 THEN 'FULL' ELSE 'PARTIAL' END,
    receipt_snapshot = CASE WHEN receipt_snapshot IS NULL THEN NULL ELSE
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(receipt_snapshot, '{version}', '2'::JSONB, true),
                  '{payment,amountPaid}', to_jsonb(v_new_amount), true
                ),
                '{payment,method}', '"MIXED"'::JSONB, true
              ),
              '{payment,allocations}', p_new_allocations, true
            ),
            '{payment,balanceBefore}', to_jsonb(v_payment.balance_before), true
          ),
          '{payment,balanceAfter}', to_jsonb(v_new_remaining), true
        ),
        '{payment,status}', to_jsonb(CASE WHEN v_new_remaining = 0 THEN 'FULL' ELSE 'PARTIAL' END), true
      )
    END
  WHERE id = v_payment.id;
  INSERT INTO public.payment_allocations (payment_id, payment_method, amount, reference)
  SELECT v_payment.id, upper(btrim(item->>'method')), round((item->>'amount')::NUMERIC, 2), NULLIF(btrim(item->>'reference'), '')
  FROM jsonb_array_elements(p_new_allocations) AS item;

  INSERT INTO public.payment_corrections (
    payment_id, old_amount, new_amount, old_method, new_method, reason, edited_by, old_allocations, new_allocations
  ) VALUES (
    v_payment.id, v_old_amount, v_new_amount, v_payment.payment_method, 'MIXED', btrim(p_reason), p_edited_by_user_id,
    v_old_allocations, p_new_allocations
  );
  RETURN v_payment.id;
END;
$$;

REVOKE ALL ON FUNCTION public.correct_split_payment_record(UUID, NUMERIC, JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.correct_split_payment_record(UUID, NUMERIC, JSONB, TEXT, UUID) TO anon, authenticated;

COMMIT;

-- Post-deploy invariant check: this query must return zero rows.
SELECT p.id, p.cleared_amount, p.payment_method, count(a.id) AS allocation_count, COALESCE(sum(a.amount), 0) AS allocated_total
FROM public.payments AS p
LEFT JOIN public.payment_allocations AS a ON a.payment_id = p.id
GROUP BY p.id, p.cleared_amount, p.payment_method
HAVING count(a.id) = 0
   OR round(COALESCE(sum(a.amount), 0), 2) <> round(p.cleared_amount, 2)
   OR (count(a.id) = 1 AND min(a.payment_method) <> p.payment_method)
   OR (count(a.id) > 1 AND p.payment_method <> 'MIXED');