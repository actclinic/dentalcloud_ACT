-- ONE-OFF PRODUCTION REPAIR: PAT-00064 / REC-20260813-000141
-- Run manually in the production Supabase SQL Editor after taking a backup.
-- This script does not change the payment amount, patient balance, payment method,
-- payment date, or receipt number. It removes one deleted treatment reference and
-- restores the commission ledger entry derived from the surviving treatment.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.payment_treatment_reference_repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  old_treatment_ids UUID[] NOT NULL,
  new_treatment_ids UUID[] NOT NULL,
  old_receipt_snapshot JSONB NOT NULL,
  new_receipt_snapshot JSONB NOT NULL,
  repaired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_treatment_reference_repairs_payment_key UNIQUE (payment_id)
);

ALTER TABLE public.payment_treatment_reference_repairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_treatment_reference_repairs FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_treatment public.treatments%ROWTYPE;
  v_doctor public.doctors%ROWTYPE;
  v_old_ids CONSTANT UUID[] := ARRAY[
    '7c6078bd-3461-4cae-9e86-baffbcf210fc'::UUID,
    '02684334-53b7-48f6-aa71-25945c85c50d'::UUID
  ];
  v_new_ids CONSTANT UUID[] := ARRAY[
    '02684334-53b7-48f6-aa71-25945c85c50d'::UUID
  ];
  v_old_snapshot JSONB;
  v_new_snapshot JSONB;
  v_stale_snapshot_count INTEGER;
  v_valid_snapshot_count INTEGER;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = '09ad9c54-5b1f-45eb-9356-8b4e2e83de20'::UUID
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Repair aborted: target payment was not found'; END IF;

  SELECT * INTO v_treatment
  FROM public.treatments
  WHERE id = '02684334-53b7-48f6-aa71-25945c85c50d'::UUID
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Repair aborted: surviving treatment was not found'; END IF;

  SELECT * INTO v_doctor
  FROM public.doctors
  WHERE id = '38dc73b2-0aa6-4db1-b001-11f71d27a557'::UUID;

  IF NOT FOUND THEN RAISE EXCEPTION 'Repair aborted: Doctor Myint Myat was not found'; END IF;

  IF v_payment.receipt_number <> 'REC-20260813-000141'
     OR v_payment.patient_id <> 'efdcf8f0-e05b-4478-90d3-155dc183f1a3'::UUID
     OR v_payment.location_id <> '38ad4ef6-e2ce-47fc-9305-3c4c7851b056'::UUID
     OR v_payment.payment_date <> DATE '2026-08-13'
     OR ROUND(v_payment.amount, 2) <> 1500000.00
     OR ROUND(v_payment.cleared_amount, 2) <> 1500000.00
     OR ROUND(v_payment.balance_before, 2) <> 3000000.00
     OR ROUND(v_payment.remaining_balance, 2) <> 1500000.00
     OR v_payment.payment_method <> 'AYA_PAY'
     OR v_payment.payment_status <> 'PARTIAL' THEN
    RAISE EXCEPTION 'Repair aborted: payment facts no longer match the investigated incident';
  END IF;

  IF v_treatment.patient_id <> v_payment.patient_id
     OR v_treatment.location_id <> v_payment.location_id
     OR v_treatment.doctor_id <> v_doctor.id
     OR v_treatment.date <> DATE '2026-08-13'
     OR ROUND(v_treatment.cost, 2) <> 3000000.00
     OR ROUND(v_treatment.standard_cost, 2) <> 3500000.00
     OR ROUND(v_treatment.discount_amount, 2) <> 500000.00
     OR v_treatment.pricing_note <> 'DISCOUNT'
     OR v_treatment.treatment_type_id <> '001560ff-9ff3-4e90-b974-88d252ddbe8c'::UUID
     OR v_doctor.commission_type <> 'percentage'
     OR ROUND(v_doctor.commission_percentage, 2) <> 40.00 THEN
    RAISE EXCEPTION 'Repair aborted: treatment or doctor facts no longer match the investigated incident';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.treatments
    WHERE id = '7c6078bd-3461-4cae-9e86-baffbcf210fc'::UUID
  ) THEN
    RAISE EXCEPTION 'Repair aborted: the stale treatment ID now exists';
  END IF;

  -- A successful previous run is an idempotent verification-only path.
  IF v_payment.treatment_ids = v_new_ids THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.payment_treatment_reference_repairs
      WHERE payment_id = v_payment.id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.doctor_commission_entries
      WHERE payment_id = v_payment.id
        AND treatment_id = v_treatment.id
        AND doctor_id = v_doctor.id
        AND allocated_payment = 1500000.00
        AND material_deduction = 0
        AND commission_base = 1500000.00
        AND commission_rate = 40.00
        AND earnings = 600000.00
    ) OR ROUND(v_treatment.doctor_earnings, 2) <> COALESCE((
      SELECT ROUND(SUM(entry.earnings), 2)
      FROM public.doctor_commission_entries AS entry
      WHERE entry.treatment_id = v_treatment.id
    ), 0) THEN
      RAISE EXCEPTION 'Repair aborted: partially repaired state requires manual review';
    END IF;
    RAISE NOTICE 'Repair already applied and verified for receipt %', v_payment.receipt_number;
    RETURN;
  END IF;

  IF v_payment.treatment_ids <> v_old_ids THEN
    RAISE EXCEPTION 'Repair aborted: treatment ID array is not the exact investigated state';
  END IF;

  IF v_payment.receipt_snapshot IS NULL
     OR jsonb_typeof(v_payment.receipt_snapshot -> 'treatments') <> 'array' THEN
    RAISE EXCEPTION 'Repair aborted: receipt treatment snapshot is missing or malformed';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE item ->> 'id' = '7c6078bd-3461-4cae-9e86-baffbcf210fc'),
    COUNT(*) FILTER (WHERE item ->> 'id' = '02684334-53b7-48f6-aa71-25945c85c50d')
  INTO v_stale_snapshot_count, v_valid_snapshot_count
  FROM jsonb_array_elements(v_payment.receipt_snapshot -> 'treatments') AS item;

  IF jsonb_array_length(v_payment.receipt_snapshot -> 'treatments') <> 2
     OR v_stale_snapshot_count <> 1
     OR v_valid_snapshot_count <> 1 THEN
    RAISE EXCEPTION 'Repair aborted: receipt snapshot is not the exact duplicated-treatment state';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.doctor_commission_entries
    WHERE payment_id = v_payment.id
  ) THEN
    RAISE EXCEPTION 'Repair aborted: the payment already has commission ledger entries';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.audit_logs AS audit
    JOIN public.patient_material_costs AS cost ON cost.audit_log_id = audit.id
    WHERE audit.source_type = 'treatment'
      AND COALESCE(audit.treatment_id, audit.source_id) = v_treatment.id
      AND cost.total_amount > 0
  ) THEN
    RAISE EXCEPTION 'Repair aborted: material/lab costs now exist; recalculate instead of using the inspected amount';
  END IF;

  v_old_snapshot := v_payment.receipt_snapshot;
  SELECT jsonb_set(
    v_payment.receipt_snapshot,
    '{treatments}',
    COALESCE(jsonb_agg(item ORDER BY ordinal), '[]'::JSONB),
    false
  )
  INTO v_new_snapshot
  FROM jsonb_array_elements(v_payment.receipt_snapshot -> 'treatments') WITH ORDINALITY AS rows(item, ordinal)
  WHERE item ->> 'id' <> '7c6078bd-3461-4cae-9e86-baffbcf210fc';

  UPDATE public.payments
  SET treatment_ids = v_new_ids,
      receipt_snapshot = v_new_snapshot
  WHERE id = v_payment.id;

  INSERT INTO public.doctor_commission_entries (
    payment_id, treatment_id, doctor_id, patient_id, location_id,
    payment_date, treatment_date, visit_key, calculation_mode,
    allocated_payment, material_deduction, commission_base, commission_rate, earnings
  ) VALUES (
    v_payment.id, v_treatment.id, v_doctor.id, v_payment.patient_id, v_payment.location_id,
    v_payment.payment_date, v_treatment.date,
    v_doctor.id::TEXT || '|' || v_payment.patient_id::TEXT || '|' || v_treatment.date::TEXT,
    'percentage', 1500000.00, 0, 1500000.00, 40.00, 600000.00
  );

  UPDATE public.treatments
  SET doctor_earnings = COALESCE((
    SELECT ROUND(SUM(entry.earnings), 2)
    FROM public.doctor_commission_entries AS entry
    WHERE entry.treatment_id = v_treatment.id
  ), 0)
  WHERE id = v_treatment.id;

  INSERT INTO public.payment_treatment_reference_repairs (
    payment_id, reason, old_treatment_ids, new_treatment_ids,
    old_receipt_snapshot, new_receipt_snapshot
  ) VALUES (
    v_payment.id,
    'Removed deleted duplicate PEEK Denture treatment reference and restored payment-based doctor commission.',
    v_old_ids, v_new_ids, v_old_snapshot, v_new_snapshot
  );

  IF (SELECT treatment_ids FROM public.payments WHERE id = v_payment.id) <> v_new_ids
     OR (SELECT ROUND(doctor_earnings, 2) FROM public.treatments WHERE id = v_treatment.id) <> COALESCE((
       SELECT ROUND(SUM(entry.earnings), 2)
       FROM public.doctor_commission_entries AS entry
       WHERE entry.treatment_id = v_treatment.id
     ), 0)
     OR NOT EXISTS (
       SELECT 1 FROM public.doctor_commission_entries
       WHERE payment_id = v_payment.id AND treatment_id = v_treatment.id AND earnings = 600000.00
     ) THEN
    RAISE EXCEPTION 'Repair postcondition failed';
  END IF;
END;
$$;

COMMIT;

SELECT
  payment.id AS payment_id,
  payment.receipt_number,
  payment.amount,
  payment.remaining_balance,
  payment.treatment_ids,
  payment.receipt_snapshot -> 'treatments' AS receipt_treatments,
  treatment.doctor_earnings,
  entry.allocated_payment,
  entry.material_deduction,
  entry.commission_base,
  entry.commission_rate,
  entry.earnings
FROM public.payments AS payment
JOIN public.treatments AS treatment
  ON treatment.id = '02684334-53b7-48f6-aa71-25945c85c50d'::UUID
JOIN public.doctor_commission_entries AS entry
  ON entry.payment_id = payment.id AND entry.treatment_id = treatment.id
WHERE payment.id = '09ad9c54-5b1f-45eb-9356-8b4e2e83de20'::UUID;