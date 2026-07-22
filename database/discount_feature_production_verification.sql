-- Read-only production verification for treatment discounts and payment rollback.
-- Expected: all *_ok columns are true and all issue counts are 0.

WITH schema_checks AS (
  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'treatments' AND column_name = 'standard_cost'
    ) AS treatment_standard_cost_column_ok,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'treatments' AND column_name = 'discount_amount'
    ) AS treatment_discount_column_ok,
    NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'discount_amount'
    ) AS retired_payment_discount_column_ok,
    to_regprocedure(
      'public.process_patient_payment(uuid,numeric,text,uuid[],date,jsonb,text,uuid,text)'
    ) IS NOT NULL AS standard_single_payment_rpc_ok,
    to_regprocedure(
      'public.process_patient_split_payment(uuid,numeric,jsonb,uuid[],date,jsonb,text,uuid,text)'
    ) IS NOT NULL AS standard_split_payment_rpc_ok,
    to_regprocedure(
      'public.process_patient_payment(uuid,numeric,numeric,text,uuid[],date,jsonb,text,uuid,text)'
    ) IS NULL AS retired_single_discount_rpc_ok,
    to_regprocedure(
      'public.process_patient_split_payment(uuid,numeric,numeric,jsonb,uuid[],date,jsonb,text,uuid,text)'
    ) IS NULL AS retired_split_discount_rpc_ok
), treatment_issues AS (
  SELECT count(*)::BIGINT AS inconsistent_treatment_pricing_count
  FROM public.treatments
  WHERE cost < 0
     OR COALESCE(discount_amount, 0) < 0
     OR (
       standard_cost IS NOT NULL
       AND abs(COALESCE(discount_amount, 0) - GREATEST(standard_cost - cost, 0)) > 0.01
     )
), allocation_issues AS (
  SELECT count(*)::BIGINT AS inconsistent_payment_allocation_count
  FROM public.payments AS payment
  LEFT JOIN (
    SELECT payment_id, count(*) AS allocation_count, COALESCE(sum(amount), 0) AS allocation_total
    FROM public.payment_allocations
    GROUP BY payment_id
  ) AS allocation ON allocation.payment_id = payment.id
  WHERE COALESCE(allocation.allocation_count, 0) = 0
     OR round(COALESCE(allocation.allocation_total, 0), 2)
        <> round(COALESCE(payment.cleared_amount, payment.amount), 2)
)
SELECT schema_checks.*, treatment_issues.*, allocation_issues.*
FROM schema_checks
CROSS JOIN treatment_issues
CROSS JOIN allocation_issues;
