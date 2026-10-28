-- Allow payment correction rows to be removed only after the secured void flow
-- has preserved those exact rows in the immutable voided-payment snapshot.

BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_payment_correction_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND EXISTS (
    SELECT 1
    FROM public.voided_payments AS voided_payment
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(voided_payment.payment_snapshot -> 'corrections', '[]'::JSONB)
    ) AS archived_correction(value)
    WHERE voided_payment.original_payment_id = OLD.payment_id
      AND archived_correction.value ->> 'id' = OLD.id::TEXT
  ) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'payment_corrections is immutable; update/delete is not allowed';
END;
$$;

COMMIT;
