-- Makes medicine-sale undo atomic and idempotent. The RPC owns all values used
-- for reversal, restores stock/balance, reverses earned loyalty, and preserves
-- an audit snapshot before deleting the live sale.

BEGIN;

ALTER TABLE public.loyalty_transactions
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_transactions_medicine_sale_source
  ON public.loyalty_transactions (source_id)
  WHERE source_type = 'MEDICINE_SALE' AND source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.voided_medicine_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_sale_id UUID NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE RESTRICT,
  sale_snapshot JSONB NOT NULL,
  loyalty_transaction_snapshot JSONB,
  reversed_points INTEGER NOT NULL DEFAULT 0,
  undone_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voided_medicine_sales_patient
  ON public.voided_medicine_sales (patient_id, undone_at DESC);

ALTER TABLE public.voided_medicine_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voided_medicine_sales FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.undo_medicine_sale(
  p_sale_id UUID,
  p_patient_id UUID,
  p_location_id UUID
)
RETURNS TABLE (
  new_balance NUMERIC(12,2),
  new_points INTEGER,
  restored_stock NUMERIC(12,2),
  reversed_points INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_sale public.medicine_sales%ROWTYPE;
  v_loyalty public.loyalty_transactions%ROWTYPE;
  v_medicine_name TEXT;
  v_expected_description TEXT;
BEGIN
  IF p_sale_id IS NULL OR p_patient_id IS NULL OR p_location_id IS NULL THEN
    RAISE EXCEPTION 'Sale, patient, and location are required' USING ERRCODE = '22023';
  END IF;

  SELECT sale.*
  INTO v_sale
  FROM public.medicine_sales AS sale
  WHERE sale.id = p_sale_id
    AND sale.patient_id = p_patient_id
    AND sale.location_id = p_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.voided_medicine_sales AS voided
      WHERE voided.original_sale_id = p_sale_id
        AND voided.patient_id = p_patient_id
        AND voided.location_id = p_location_id
    ) THEN
      RAISE EXCEPTION 'Medicine sale has already been undone' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'Medicine sale was not found for this patient and location' USING ERRCODE = 'P0002';
  END IF;

  SELECT medicine.name
  INTO v_medicine_name
  FROM public.medicines AS medicine
  WHERE medicine.id = v_sale.medicine_id
    AND medicine.location_id = v_sale.location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medicine was not found for this sale';
  END IF;

  PERFORM 1
  FROM public.patients AS patient
  WHERE patient.id = v_sale.patient_id
    AND patient.location_id = v_sale.location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient was not found for this sale';
  END IF;

  v_expected_description := format(
    'Earned from medicine purchase: %s (Qty: %s)',
    v_medicine_name,
    v_sale.quantity
  );

  SELECT loyalty_tx.*
  INTO v_loyalty
  FROM public.loyalty_transactions AS loyalty_tx
  WHERE loyalty_tx.patient_id = v_sale.patient_id
    AND loyalty_tx.location_id = v_sale.location_id
    AND loyalty_tx.type = 'EARNED'
    AND loyalty_tx.points > 0
    AND (
      (loyalty_tx.source_type = 'MEDICINE_SALE' AND loyalty_tx.source_id = v_sale.id)
      OR (
        loyalty_tx.source_id IS NULL
        AND (
          loyalty_tx.description = v_expected_description
          OR split_part(loyalty_tx.description, ' (Qty:', 1)
             = 'Earned from medicine purchase: ' || v_medicine_name
        )
        AND loyalty_tx.date BETWEEN v_sale.created_at - INTERVAL '1 minute'
                                 AND v_sale.created_at + INTERVAL '10 minutes'
      )
    )
  ORDER BY
    CASE WHEN loyalty_tx.source_id = v_sale.id THEN 0 ELSE 1 END,
    ABS(EXTRACT(EPOCH FROM (loyalty_tx.date - v_sale.created_at))),
    loyalty_tx.id
  LIMIT 1
  FOR UPDATE;

  INSERT INTO public.voided_medicine_sales (
    original_sale_id,
    patient_id,
    location_id,
    medicine_id,
    sale_snapshot,
    loyalty_transaction_snapshot,
    reversed_points
  ) VALUES (
    v_sale.id,
    v_sale.patient_id,
    v_sale.location_id,
    v_sale.medicine_id,
    to_jsonb(v_sale),
    CASE WHEN v_loyalty.id IS NULL THEN NULL ELSE to_jsonb(v_loyalty) END,
    COALESCE(v_loyalty.points, 0)
  );

  UPDATE public.medicines
  SET stock = ROUND((COALESCE(stock, 0) + v_sale.quantity)::NUMERIC, 2),
      updated_at = NOW()
  WHERE id = v_sale.medicine_id
    AND location_id = v_sale.location_id
  RETURNING stock INTO restored_stock;

  UPDATE public.patients
  SET balance = GREATEST(0, ROUND((COALESCE(balance, 0) - v_sale.total_price)::NUMERIC, 2)),
      loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) - COALESCE(v_loyalty.points, 0))
  WHERE id = v_sale.patient_id
    AND location_id = v_sale.location_id
  RETURNING balance, loyalty_points INTO new_balance, new_points;

  IF v_loyalty.id IS NOT NULL THEN
    DELETE FROM public.loyalty_transactions WHERE id = v_loyalty.id;
  END IF;

  DELETE FROM public.medicine_sales WHERE id = v_sale.id;

  reversed_points := COALESCE(v_loyalty.points, 0);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.undo_medicine_sale(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undo_medicine_sale(UUID, UUID, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
