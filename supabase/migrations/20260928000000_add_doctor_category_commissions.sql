-- Category overrides sit between enabled treatment overrides and doctor defaults.
-- Existing treatment snapshots are intentionally untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.doctor_treatment_commissions
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.doctor_category_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  fixed_amount NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT doctor_category_commissions_category_check CHECK (category = btrim(category) AND category <> ''),
  CONSTRAINT doctor_category_commissions_rate_check CHECK (commission_rate BETWEEN 0 AND 100),
  CONSTRAINT doctor_category_commissions_fixed_check CHECK (fixed_amount IS NULL OR fixed_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS doctor_category_commissions_doctor_category_key
  ON public.doctor_category_commissions (doctor_id, lower(category));
CREATE INDEX IF NOT EXISTS doctor_category_commissions_doctor_idx
  ON public.doctor_category_commissions (doctor_id);

ALTER TABLE public.doctor_category_commissions ENABLE ROW LEVEL SECURITY;
-- ACT currently uses custom application authentication and the same permissive
-- Data API access model as doctor_treatment_commissions. Review both tables
-- together before changing this policy model.
DROP POLICY IF EXISTS doctor_category_commissions_access ON public.doctor_category_commissions;
CREATE POLICY doctor_category_commissions_access ON public.doctor_category_commissions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_category_commissions TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_applicable_commission_rate(
  p_doctor_id UUID, p_treatment_id UUID
) RETURNS DECIMAL(12,2)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type TEXT;
  v_default_fixed NUMERIC(12,2);
  v_default_percentage NUMERIC(5,2);
  v_treatment_rate NUMERIC(5,2);
  v_treatment_fixed NUMERIC(12,2);
  v_category_rate NUMERIC(5,2);
  v_category_fixed NUMERIC(12,2);
BEGIN
  SELECT d.commission_type, COALESCE(d.commission_per_visit, 0), COALESCE(d.commission_percentage, 0)
  INTO v_type, v_default_fixed, v_default_percentage
  FROM public.doctors d WHERE d.id = p_doctor_id;

  SELECT dtc.commission_rate, dtc.fixed_amount
  INTO v_treatment_rate, v_treatment_fixed
  FROM public.doctor_treatment_commissions dtc
  WHERE dtc.doctor_id = p_doctor_id
    AND dtc.treatment_id = p_treatment_id
    AND dtc.is_enabled = TRUE;

  SELECT cat.commission_rate, cat.fixed_amount
  INTO v_category_rate, v_category_fixed
  FROM public.treatment_types tt
  JOIN public.doctor_category_commissions cat
    ON cat.doctor_id = p_doctor_id
   AND lower(cat.category) = lower(btrim(tt.category))
  WHERE tt.id = p_treatment_id
    AND btrim(COALESCE(tt.category, '')) <> '';

  IF v_type = 'flat_visit' THEN
    IF v_treatment_fixed IS NOT NULL THEN RETURN v_treatment_fixed; END IF;
    IF v_category_fixed IS NOT NULL THEN RETURN v_category_fixed; END IF;
    RETURN COALESCE(v_default_fixed, 0);
  END IF;
  IF v_treatment_rate IS NOT NULL THEN RETURN v_treatment_rate; END IF;
  IF v_category_rate IS NOT NULL THEN RETURN v_category_rate; END IF;
  RETURN COALESCE(v_default_percentage, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_applicable_commission_rate(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_applicable_commission_rate(UUID, UUID) TO anon, authenticated;

-- ACT snapshots commissions directly in this function. Keep its precedence in
-- sync with get_applicable_commission_rate without rewriting historical rows.
CREATE OR REPLACE FUNCTION public.resolve_treatment_commission_snapshot(
  p_doctor_id UUID, p_treatment_type_id UUID
)
RETURNS TABLE (commission_type TEXT, commission_rate NUMERIC, commission_source TEXT)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_doctor public.doctors%ROWTYPE;
  v_treatment public.doctor_treatment_commissions%ROWTYPE;
  v_category public.doctor_category_commissions%ROWTYPE;
BEGIN
  IF p_doctor_id IS NULL THEN
    RETURN QUERY SELECT 'percentage'::TEXT, 0::NUMERIC, 'no_doctor'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_doctor FROM public.doctors WHERE id = p_doctor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot snapshot commission: doctor % is missing or inaccessible', p_doctor_id;
  END IF;

  SELECT * INTO v_treatment
  FROM public.doctor_treatment_commissions
  WHERE doctor_id = p_doctor_id
    AND treatment_id = p_treatment_type_id
    AND is_enabled = TRUE;

  SELECT category_rule.* INTO v_category
  FROM public.treatment_types treatment_type
  JOIN public.doctor_category_commissions category_rule
    ON category_rule.doctor_id = p_doctor_id
   AND lower(category_rule.category) = lower(btrim(treatment_type.category))
  WHERE treatment_type.id = p_treatment_type_id
    AND btrim(COALESCE(treatment_type.category, '')) <> '';

  commission_type := COALESCE(v_doctor.commission_type,
    CASE WHEN btrim(v_doctor.specialization) IN ('Ortho', 'Implant', 'Surgery')
      THEN 'flat_visit' ELSE 'percentage' END);

  IF commission_type = 'flat_visit' THEN
    commission_rate := COALESCE(v_treatment.fixed_amount, v_category.fixed_amount, v_doctor.commission_per_visit, 0);
    commission_source := CASE
      WHEN v_treatment.fixed_amount IS NOT NULL THEN 'custom'
      WHEN v_category.fixed_amount IS NOT NULL THEN 'category'
      ELSE 'default'
    END;
  ELSE
    commission_rate := COALESCE(v_treatment.commission_rate, v_category.commission_rate, v_doctor.commission_percentage, 0);
    commission_source := CASE
      WHEN v_treatment.commission_rate IS NOT NULL THEN 'custom'
      WHEN v_category.commission_rate IS NOT NULL THEN 'category'
      ELSE 'default'
    END;
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_treatment_commission_snapshot(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_treatment_commission_snapshot(UUID, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
