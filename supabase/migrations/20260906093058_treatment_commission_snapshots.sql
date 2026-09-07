-- Capture commission at treatment creation, not at payment collection.
-- No payment, ledger, or stored earnings values are rewritten by this migration.
BEGIN;

-- Keep the baseline consistent with concurrent settings/ledger writes.
LOCK TABLE public.doctors, public.doctor_treatment_commissions,
  public.treatments, public.doctor_commission_entries IN SHARE ROW EXCLUSIVE MODE;

-- Also reconciles fresh installations that predate fixed treatment overrides.
ALTER TABLE public.doctor_treatment_commissions
  ADD COLUMN IF NOT EXISTS fixed_amount NUMERIC(12,2);

ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS commission_type_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS commission_source_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS commission_snapshotted_at TIMESTAMPTZ;

-- Shared by INSERT/assignment changes and the one-time legacy baseline.
CREATE OR REPLACE FUNCTION public.resolve_treatment_commission_snapshot(
  p_doctor_id UUID, p_treatment_type_id UUID
)
RETURNS TABLE (commission_type TEXT, commission_rate NUMERIC, commission_source TEXT)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_doctor public.doctors%ROWTYPE;
  v_custom public.doctor_treatment_commissions%ROWTYPE;
BEGIN
  IF p_doctor_id IS NULL THEN
    RETURN QUERY SELECT 'percentage'::TEXT, 0::NUMERIC, 'no_doctor'::TEXT;
    RETURN;
  END IF;
  SELECT * INTO v_doctor FROM public.doctors WHERE id = p_doctor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot snapshot commission: doctor % is missing or inaccessible', p_doctor_id;
  END IF;
  SELECT * INTO v_custom FROM public.doctor_treatment_commissions
  WHERE doctor_id = p_doctor_id AND treatment_id = p_treatment_type_id;

  commission_type := COALESCE(v_doctor.commission_type,
    CASE WHEN btrim(v_doctor.specialization) IN ('Ortho', 'Implant', 'Surgery')
      THEN 'flat_visit' ELSE 'percentage' END);
  IF commission_type = 'flat_visit' THEN
    commission_rate := COALESCE(v_custom.fixed_amount, v_doctor.commission_per_visit, 0);
    commission_source := CASE WHEN v_custom.fixed_amount IS NOT NULL THEN 'custom' ELSE 'default' END;
  ELSE
    commission_rate := COALESCE(v_custom.commission_rate, v_doctor.commission_percentage, 0);
    commission_source := CASE WHEN v_custom.commission_rate IS NOT NULL THEN 'custom' ELSE 'default' END;
  END IF;
  RETURN NEXT;
END;
$$;

-- Never guess between contradictory paid histories. Resolve these explicitly
-- before deployment; the transaction rolls back without touching ledger rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT e.treatment_id
    FROM public.doctor_commission_entries e
    JOIN public.treatments t ON t.id = e.treatment_id
    WHERE t.commission_type_snapshot IS NULL
    GROUP BY e.treatment_id
    HAVING COUNT(DISTINCT (e.calculation_mode, e.commission_rate)) > 1
  ) THEN
    RAISE EXCEPTION 'Commission snapshot backfill aborted: conflicting ledger methods/rates for a treatment. Review historical ledger data first.';
  END IF;
  IF EXISTS (
    SELECT e.visit_key FROM public.doctor_commission_entries e
    WHERE e.calculation_mode = 'flat_visit'
    GROUP BY e.visit_key HAVING COUNT(DISTINCT e.commission_rate) > 1
  ) THEN
    RAISE EXCEPTION 'Commission snapshot backfill aborted: conflicting fixed amounts for a visit. Review historical ledger data first.';
  END IF;
END;
$$;

-- A fixed ledger row represents the whole visit, including sibling treatments
-- without their own ledger entry. Percentage rates remain treatment-specific.
WITH snapshots AS (
  SELECT t.id,
    COALESCE(paid.calculation_mode, visit_paid.calculation_mode, applicable.commission_type) AS method,
    COALESCE(paid.commission_rate, visit_paid.commission_rate, applicable.commission_rate) AS rate,
    CASE WHEN paid.treatment_id IS NOT NULL THEN 'ledger'
      WHEN visit_paid.treatment_id IS NOT NULL THEN 'legacy_visit'
      ELSE 'legacy_' || applicable.commission_source END AS source
  FROM public.treatments t
  CROSS JOIN LATERAL public.resolve_treatment_commission_snapshot(t.doctor_id, t.treatment_type_id) applicable
  LEFT JOIN LATERAL (
    SELECT e.treatment_id, e.calculation_mode, e.commission_rate
    FROM public.doctor_commission_entries e WHERE e.treatment_id = t.id
    ORDER BY e.payment_date, e.id LIMIT 1
  ) paid ON TRUE
  LEFT JOIN LATERAL (
    SELECT e.treatment_id, e.calculation_mode, e.commission_rate
    FROM public.doctor_commission_entries e
    WHERE e.doctor_id = t.doctor_id AND e.patient_id = t.patient_id
      AND e.treatment_date = t.date AND e.calculation_mode = 'flat_visit'
    ORDER BY e.payment_date, e.id LIMIT 1
  ) visit_paid ON TRUE
  WHERE t.commission_type_snapshot IS NULL AND t.commission_rate_snapshot IS NULL
)
UPDATE public.treatments t
SET commission_type_snapshot = s.method, commission_rate_snapshot = s.rate,
    commission_source_snapshot = s.source, commission_snapshotted_at = CURRENT_TIMESTAMP
FROM snapshots s WHERE s.id = t.id;

ALTER TABLE public.treatments
  DROP CONSTRAINT IF EXISTS treatments_commission_snapshot_check;
ALTER TABLE public.treatments
  ADD CONSTRAINT treatments_commission_snapshot_check CHECK (
    commission_type_snapshot IN ('percentage', 'flat_visit')
    AND commission_rate_snapshot >= 0
    AND (commission_type_snapshot <> 'percentage' OR commission_rate_snapshot <= 100)
  ),
  ALTER COLUMN commission_type_snapshot SET NOT NULL,
  ALTER COLUMN commission_rate_snapshot SET NOT NULL,
  ALTER COLUMN commission_source_snapshot SET NOT NULL,
  ALTER COLUMN commission_snapshotted_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.capture_treatment_commission_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_snapshot RECORD;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.doctor_id IS NOT DISTINCT FROM OLD.doctor_id
      AND NEW.treatment_type_id IS NOT DISTINCT FROM OLD.treatment_type_id THEN
      -- Reject direct snapshot tampering, including attempts to clear it.
      IF ROW(NEW.commission_type_snapshot, NEW.commission_rate_snapshot,
             NEW.commission_source_snapshot, NEW.commission_snapshotted_at)
        IS DISTINCT FROM ROW(OLD.commission_type_snapshot, OLD.commission_rate_snapshot,
             OLD.commission_source_snapshot, OLD.commission_snapshotted_at) THEN
        RAISE EXCEPTION 'Treatment commission snapshot is immutable; change the assigned doctor/type through the authorized correction flow.';
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  SELECT * INTO v_snapshot
  FROM public.resolve_treatment_commission_snapshot(NEW.doctor_id, NEW.treatment_type_id);
  NEW.commission_type_snapshot := v_snapshot.commission_type;
  NEW.commission_rate_snapshot := v_snapshot.commission_rate;
  NEW.commission_source_snapshot := v_snapshot.commission_source;
  NEW.commission_snapshotted_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_treatment_commission_snapshot ON public.treatments;
CREATE TRIGGER trg_capture_treatment_commission_snapshot
BEFORE INSERT OR UPDATE ON public.treatments
FOR EACH ROW EXECUTE FUNCTION public.capture_treatment_commission_snapshot();

REVOKE ALL ON FUNCTION public.resolve_treatment_commission_snapshot(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_treatment_commission_snapshot(UUID, UUID) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.capture_treatment_commission_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_treatment_commission_snapshot() TO anon, authenticated, service_role;

COMMENT ON COLUMN public.treatments.commission_source_snapshot IS
  'custom/default/no_doctor for new assignments; ledger/legacy_visit from paid history; legacy_* is an installation-time baseline, not a reconstructed historical rate.';
NOTIFY pgrst, 'reload schema';
COMMIT;
