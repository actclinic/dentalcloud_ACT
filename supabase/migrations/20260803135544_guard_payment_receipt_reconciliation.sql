-- Reject new payment rows whose itemized receipt cannot explain the amount.
-- Legacy clients remain compatible because enforcement is opt-in through the
-- reconciliation marker added by the updated checkout flow.

CREATE OR REPLACE FUNCTION public.guard_payment_receipt_reconciliation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_service_fee NUMERIC(12,2) := 0;
  v_treatment_total NUMERIC(12,2) := 0;
  v_medicine_total NUMERIC(12,2) := 0;
  v_captured_total NUMERIC(12,2) := 0;
BEGIN
  IF NEW.receipt_snapshot IS NULL
     OR COALESCE(NEW.receipt_snapshot #>> '{reconciliation,version}', '') <> '1' THEN
    RETURN NEW;
  END IF;

  v_service_fee := ROUND(COALESCE(
    NULLIF(BTRIM(COALESCE(NEW.receipt_snapshot #>> '{payment,serviceFeeAmount}', '')), '')::NUMERIC,
    0
  ), 2);

  SELECT ROUND(COALESCE(SUM(NULLIF(BTRIM(item->>'finalCost'), '')::NUMERIC), 0), 2)
  INTO v_treatment_total
  FROM jsonb_array_elements(COALESCE(NEW.receipt_snapshot->'treatments', '[]'::JSONB)) AS item;

  SELECT ROUND(COALESCE(SUM(NULLIF(BTRIM(item->>'totalPrice'), '')::NUMERIC), 0), 2)
  INTO v_medicine_total
  FROM jsonb_array_elements(COALESCE(NEW.receipt_snapshot->'medicines', '[]'::JSONB)) AS item;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(NEW.treatment_ids, ARRAY[]::UUID[])) AS linked_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(NEW.receipt_snapshot->'treatments', '[]'::JSONB)) AS item
      WHERE item->>'id' = linked_id::TEXT
    )
  ) THEN
    RAISE EXCEPTION 'Payment receipt is missing one or more linked treatments'
      USING ERRCODE = '22023';
  END IF;

  v_captured_total := ROUND(v_service_fee + v_treatment_total + v_medicine_total, 2);
  IF ROUND(COALESCE(NEW.amount, 0), 2) > v_captured_total THEN
    RAISE EXCEPTION 'Payment details are missing % of billable items',
      ROUND(NEW.amount - v_captured_total, 2)
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_payment_receipt_reconciliation ON public.payments;
CREATE TRIGGER guard_payment_receipt_reconciliation
BEFORE INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.guard_payment_receipt_reconciliation();

REVOKE ALL ON FUNCTION public.guard_payment_receipt_reconciliation() FROM PUBLIC, anon, authenticated;
