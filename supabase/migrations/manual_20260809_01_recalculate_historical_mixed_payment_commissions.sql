-- MANUAL ONE-TIME REPAIR. Run in the Supabase SQL editor after deploying the
-- application change that deducts medicine and service fees before commission.
-- It corrects historical percentage commission rows only; flat-visit rows are
-- deliberately preserved.

BEGIN;

CREATE TABLE IF NOT EXISTS public.doctor_earnings_mixed_payment_backup_20260809 AS
SELECT id AS treatment_id, doctor_earnings AS previous_doctor_earnings, NOW() AS backed_up_at
FROM public.treatments
WITH NO DATA;

INSERT INTO public.doctor_earnings_mixed_payment_backup_20260809 (treatment_id, previous_doctor_earnings, backed_up_at)
SELECT treatment.id, treatment.doctor_earnings, NOW()
FROM public.treatments AS treatment
WHERE NOT EXISTS (
  SELECT 1 FROM public.doctor_earnings_mixed_payment_backup_20260809 AS backup
  WHERE backup.treatment_id = treatment.id
);

CREATE TABLE IF NOT EXISTS public.doctor_commission_entries_mixed_payment_backup_20260809 AS
SELECT id AS commission_entry_id, allocated_payment, material_deduction, commission_base, earnings, NOW() AS backed_up_at
FROM public.doctor_commission_entries
WITH NO DATA;

INSERT INTO public.doctor_commission_entries_mixed_payment_backup_20260809
  (commission_entry_id, allocated_payment, material_deduction, commission_base, earnings, backed_up_at)
SELECT entry.id, entry.allocated_payment, entry.material_deduction, entry.commission_base, entry.earnings, NOW()
FROM public.doctor_commission_entries AS entry
WHERE NOT EXISTS (
  SELECT 1 FROM public.doctor_commission_entries_mixed_payment_backup_20260809 AS backup
  WHERE backup.commission_entry_id = entry.id
);

DROP TABLE IF EXISTS public.recalculated_mixed_payment_commissions_20260809;

CREATE TABLE public.recalculated_mixed_payment_commissions_20260809 AS
WITH payment_targets AS (
  SELECT
    payment.id AS payment_id,
    treatment.id AS treatment_id,
    GREATEST(0,
      COALESCE(payment.cleared_amount, payment.amount, 0)
      - COALESCE(NULLIF(payment.receipt_snapshot #>> '{payment,serviceFeeAmount}', '')::NUMERIC, 0)
      - COALESCE((
        SELECT SUM(GREATEST(0, NULLIF(medicine #>> '{totalPrice}', '')::NUMERIC))
        FROM jsonb_array_elements(COALESCE(payment.receipt_snapshot -> 'medicines', '[]'::JSONB)) AS medicine
      ), 0)
    ) AS commissionable_payment,
    GREATEST(0, COALESCE(treatment.cost, 0)) AS treatment_amount
  FROM public.payments AS payment
  JOIN public.treatments AS treatment ON (
    (COALESCE(cardinality(payment.treatment_ids), 0) > 0 AND treatment.id = ANY(payment.treatment_ids))
    OR (
      COALESCE(cardinality(payment.treatment_ids), 0) = 0
      AND payment.receipt_snapshot @> jsonb_build_object('treatments', jsonb_build_array(jsonb_build_object('id', treatment.id::TEXT)))
    )
    OR (
      COALESCE(cardinality(payment.treatment_ids), 0) = 0
      AND COALESCE(payment.receipt_snapshot -> 'treatments', '[]'::JSONB) = '[]'::JSONB
      AND treatment.patient_id = payment.patient_id
      AND treatment.date = payment.payment_date
    )
  )
), payment_totals AS (
  SELECT payment_id, SUM(treatment_amount) AS total_treatment_amount, COUNT(*) AS linked_treatment_count
  FROM payment_targets
  GROUP BY payment_id
), payment_allocations AS (
  SELECT
    target.payment_id,
    target.treatment_id,
    ROUND(CASE
      WHEN totals.total_treatment_amount > 0
        THEN target.commissionable_payment * target.treatment_amount / totals.total_treatment_amount
      ELSE target.commissionable_payment / NULLIF(totals.linked_treatment_count, 0)
    END, 2) AS allocated_payment
  FROM payment_targets AS target
  JOIN payment_totals AS totals ON totals.payment_id = target.payment_id
), material_costs AS (
  SELECT audit.source_id AS treatment_id, COALESCE(SUM(cost.total_amount), 0) AS material_lab_cost
  FROM public.audit_logs AS audit
  JOIN public.patient_material_costs AS cost ON cost.audit_log_id = audit.id
  WHERE audit.source_type = 'treatment'
  GROUP BY audit.source_id
), treatment_totals AS (
  SELECT treatment_id, SUM(allocated_payment) AS collected_payment
  FROM payment_allocations
  GROUP BY treatment_id
), percentage_treatments AS (
  SELECT
    treatment.id AS treatment_id,
    treatment.patient_id,
    treatment.doctor_id,
    treatment.date AS treatment_date,
    COALESCE(totals.collected_payment, 0) AS collected_payment,
    COALESCE(material_costs.material_lab_cost, 0) AS material_lab_cost,
    COALESCE(
      (SELECT entry.commission_rate FROM public.doctor_commission_entries AS entry
       WHERE entry.treatment_id = treatment.id AND entry.calculation_mode = 'percentage'
       ORDER BY entry.payment_date, entry.created_at, entry.id LIMIT 1),
      custom_rate.commission_rate, doctor.commission_percentage, 0
    ) AS commission_rate
  FROM public.treatments AS treatment
  JOIN public.doctors AS doctor ON doctor.id = treatment.doctor_id
  LEFT JOIN treatment_totals AS totals ON totals.treatment_id = treatment.id
  LEFT JOIN material_costs ON material_costs.treatment_id = treatment.id
  LEFT JOIN public.doctor_treatment_commissions AS custom_rate
    ON custom_rate.doctor_id = treatment.doctor_id AND custom_rate.treatment_id = treatment.treatment_type_id
  WHERE COALESCE(doctor.commission_type, 'percentage') = 'percentage'
), visit_totals AS (
  SELECT patient_id, doctor_id, treatment_date, SUM(collected_payment) AS collected_payment,
    SUM(material_lab_cost) AS material_lab_cost, MIN(commission_rate) AS commission_rate,
    MAX(commission_rate) AS max_commission_rate
  FROM percentage_treatments
  GROUP BY patient_id, doctor_id, treatment_date
  HAVING MIN(commission_rate) = MAX(commission_rate)
), provisional AS (
  SELECT treatment.*, visit.collected_payment AS visit_collected_payment,
    ROUND(GREATEST(0, visit.collected_payment - visit.material_lab_cost) * (visit.commission_rate / 100.0), 2) AS visit_earnings,
    ROW_NUMBER() OVER (PARTITION BY treatment.patient_id, treatment.doctor_id, treatment.treatment_date ORDER BY treatment.treatment_id) AS row_number,
    COUNT(*) OVER (PARTITION BY treatment.patient_id, treatment.doctor_id, treatment.treatment_date) AS treatment_count,
    ROUND(CASE WHEN visit.collected_payment > 0 THEN
      GREATEST(0, visit.collected_payment - visit.material_lab_cost) * (visit.commission_rate / 100.0)
      * treatment.collected_payment / visit.collected_payment ELSE 0 END, 2) AS provisional_earnings
  FROM percentage_treatments AS treatment
  JOIN visit_totals AS visit ON visit.patient_id = treatment.patient_id
    AND visit.doctor_id = treatment.doctor_id AND visit.treatment_date = treatment.treatment_date
), distributed AS (
  SELECT *, ROUND(GREATEST(0, CASE WHEN row_number = treatment_count THEN visit_earnings - COALESCE(
    SUM(provisional_earnings) OVER (PARTITION BY patient_id, doctor_id, treatment_date ORDER BY row_number ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0
  ) ELSE provisional_earnings END), 2) AS earnings
  FROM provisional
)
SELECT treatment_id, collected_payment, material_lab_cost, commission_rate, earnings
FROM distributed;

UPDATE public.treatments AS treatment
SET doctor_earnings = corrected.earnings
FROM public.recalculated_mixed_payment_commissions_20260809 AS corrected
WHERE treatment.id = corrected.treatment_id;

WITH ledger_totals AS (
  SELECT treatment_id, SUM(allocated_payment) AS allocated_payment_total
  FROM public.doctor_commission_entries
  WHERE calculation_mode = 'percentage'
  GROUP BY treatment_id
), entry_values AS (
  SELECT entry.id, corrected.earnings, corrected.commission_rate,
    ROUND(corrected.collected_payment * COALESCE(entry.allocated_payment, 0) / NULLIF(totals.allocated_payment_total, 0), 2) AS allocated_payment,
    COALESCE(entry.allocated_payment, 0) / NULLIF(totals.allocated_payment_total, 0) AS share
  FROM public.doctor_commission_entries AS entry
  JOIN public.recalculated_mixed_payment_commissions_20260809 AS corrected ON corrected.treatment_id = entry.treatment_id
  JOIN ledger_totals AS totals ON totals.treatment_id = entry.treatment_id
  WHERE entry.calculation_mode = 'percentage'
)
UPDATE public.doctor_commission_entries AS entry
SET allocated_payment = values.allocated_payment,
  earnings = ROUND(values.earnings * values.share, 2),
  commission_base = CASE WHEN values.commission_rate > 0 THEN ROUND(values.earnings * values.share / (values.commission_rate / 100.0), 2) ELSE 0 END,
  material_deduction = GREATEST(0, values.allocated_payment - CASE WHEN values.commission_rate > 0 THEN ROUND(values.earnings * values.share / (values.commission_rate / 100.0), 2) ELSE 0 END)
FROM entry_values AS values
WHERE entry.id = values.id;

COMMIT;
