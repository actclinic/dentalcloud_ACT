-- Roll back the retired collection-payment discount feature.
-- This intentionally leaves public.treatments.discount_amount untouched.
-- Safe to rerun. The transaction aborts if a discounted payment exists.

BEGIN;

DO $$
DECLARE
  v_discounted_payment_count BIGINT := 0;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name = 'discount_amount'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.payments WHERE discount_amount > 0'
      INTO v_discounted_payment_count;

    IF v_discounted_payment_count > 0 THEN
      RAISE EXCEPTION
        'Rollback stopped: % payment record(s) contain collection discounts. Reverse those financial records before removing the feature.',
        v_discounted_payment_count;
    END IF;
  END IF;
END;
$$;

-- Remove only the overloads introduced by payment_collection_discount_migration.sql.
DROP FUNCTION IF EXISTS public.process_patient_payment(
  UUID, NUMERIC, NUMERIC, TEXT, UUID[], DATE, JSONB, TEXT, UUID, TEXT
);

DROP FUNCTION IF EXISTS public.process_patient_split_payment(
  UUID, NUMERIC, NUMERIC, JSONB, UUID[], DATE, JSONB, TEXT, UUID, TEXT
);

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_discount_amount_check;

ALTER TABLE public.payments
  DROP COLUMN IF EXISTS discount_amount;

-- Restore allocation behavior from split_payment_allocations_migration.sql.
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

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = v_payment_id;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT count(*), COALESCE(sum(amount), 0), min(payment_method)
  INTO v_count, v_total, v_only_method
  FROM public.payment_allocations
  WHERE payment_id = v_payment_id;

  IF v_count = 0
     OR round(v_total, 2) <> round(COALESCE(v_payment.cleared_amount, v_payment.amount), 2) THEN
    RAISE EXCEPTION
      'Payment allocation total (%) must equal payment amount (%)',
      v_total,
      COALESCE(v_payment.cleared_amount, v_payment.amount);
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

-- Trigger helpers must not be callable as public RPC endpoints. Their triggers
-- continue to execute with the function owner's privileges.
REVOKE ALL ON FUNCTION public.create_legacy_payment_allocation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_legacy_payment_allocation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_payment_allocation_total() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Expected result after success: false, false, false, true, true.
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name = 'discount_amount'
  ) AS payment_discount_column_still_exists,
  to_regprocedure(
    'public.process_patient_payment(uuid,numeric,numeric,text,uuid[],date,jsonb,text,uuid,text)'
  ) IS NOT NULL AS discounted_single_payment_rpc_still_exists,
  to_regprocedure(
    'public.process_patient_split_payment(uuid,numeric,numeric,jsonb,uuid[],date,jsonb,text,uuid,text)'
  ) IS NOT NULL AS discounted_split_payment_rpc_still_exists,
  to_regprocedure(
    'public.process_patient_payment(uuid,numeric,text,uuid[],date,jsonb,text,uuid,text)'
  ) IS NOT NULL AS standard_single_payment_rpc_exists,
  to_regprocedure(
    'public.process_patient_split_payment(uuid,numeric,jsonb,uuid[],date,jsonb,text,uuid,text)'
  ) IS NOT NULL AS standard_split_payment_rpc_exists;
