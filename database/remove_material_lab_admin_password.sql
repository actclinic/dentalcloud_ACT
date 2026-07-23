-- ============================================================================
-- Remove Material & Lab administrator password re-entry
-- ============================================================================
-- Production deployment order:
--   1. Run this migration.
--   2. Deploy the matching frontend.
--
-- The legacy p_admin_password parameters intentionally remain in both RPC
-- signatures so old and new frontend deployments can overlap safely. New
-- clients pass a server-issued session token through that parameter; old clients
-- may continue passing the administrator password during the rollout.

BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_auth_sessions (
  session_token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_staff_auth_sessions_user_id ON public.staff_auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_auth_sessions_expires_at ON public.staff_auth_sessions(expires_at);
ALTER TABLE public.staff_auth_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_auth_sessions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.authenticate_staff_user_session(p_username TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID, location_id UUID, username TEXT, role TEXT, allowed_tabs JSONB,
  doctor_id UUID, auth_session_token TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user public.users%ROWTYPE; v_token UUID;
BEGIN
  SELECT u.* INTO v_user FROM public.users u
  WHERE lower(u.username) = lower(btrim(p_username))
    AND (u.password = p_password OR btrim(u.password) = btrim(p_password)) LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  DELETE FROM public.staff_auth_sessions WHERE expires_at <= NOW() OR revoked_at IS NOT NULL;
  INSERT INTO public.staff_auth_sessions(user_id) VALUES (v_user.id) RETURNING session_token INTO v_token;
  RETURN QUERY SELECT v_user.id, v_user.location_id, v_user.username::TEXT, v_user.role::TEXT,
    v_user.allowed_tabs, v_user.doctor_id, v_token::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_staff_auth_session(p_session_token TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.staff_auth_sessions SET revoked_at = NOW()
  WHERE session_token::TEXT = btrim(p_session_token) AND revoked_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.authenticate_staff_user_session(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authenticate_staff_user_session(TEXT, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_staff_auth_session(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_staff_auth_session(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.replace_treatment_costs(
  p_audit_log_id UUID,
  p_items JSONB,
  p_admin_user_id UUID,
  p_admin_password TEXT,
  p_request_token UUID
)
RETURNS SETOF public.patient_material_costs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material_total NUMERIC(12,2);
  v_lab_total NUMERIC(12,2);
  v_admin_username TEXT;
  v_location_id UUID;
  v_treatment_date DATE;
  v_patient_id UUID;
  v_patient_name TEXT;
  v_treatment_label TEXT;
  v_material_names TEXT;
  v_lab_names TEXT;
BEGIN
  SELECT u.username INTO v_admin_username
  FROM public.users u
  WHERE u.id = p_admin_user_id
    AND u.role = 'admin'
    AND (
      u.password = p_admin_password OR btrim(u.password) = btrim(p_admin_password)
      OR EXISTS (
        SELECT 1 FROM public.staff_auth_sessions s
        WHERE s.user_id = u.id AND s.session_token::TEXT = btrim(p_admin_password)
          AND s.revoked_at IS NULL AND s.expires_at > NOW()
      )
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A valid administrator session is required.';
  END IF;

  SELECT t.location_id, t.date, t.patient_id, COALESCE(p.name, 'Unknown patient'), COALESCE(t.description, 'Treatment')
  INTO v_location_id, v_treatment_date, v_patient_id, v_patient_name, v_treatment_label
  FROM public.audit_logs a
  JOIN public.treatments t ON t.id = a.source_id
  LEFT JOIN public.patients p ON p.id = t.patient_id
  WHERE a.id = p_audit_log_id
    AND a.source_type = 'treatment'
  FOR UPDATE OF a;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Treatment audit row was not found.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Cost items must be a JSON array.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS item(
      material_name TEXT, cost_type TEXT, cost_amount NUMERIC, quantity NUMERIC
    )
    WHERE btrim(COALESCE(item.material_name, '')) = ''
       OR item.cost_type NOT IN ('material', 'lab')
       OR item.cost_amount IS NULL OR item.cost_amount <= 0
       OR item.quantity IS NULL OR item.quantity <= 0
  ) THEN
    RAISE EXCEPTION 'Every cost item requires a valid name, type, positive cost, and positive quantity.';
  END IF;

  DELETE FROM public.patient_material_costs WHERE audit_log_id = p_audit_log_id;

  INSERT INTO public.patient_material_costs (
    audit_log_id, material_name, cost_type, cost_amount, quantity, created_by, created_by_name
  )
  SELECT
    p_audit_log_id,
    btrim(item.material_name),
    item.cost_type,
    item.cost_amount,
    item.quantity,
    p_admin_user_id,
    v_admin_username
  FROM jsonb_to_recordset(p_items) AS item(
    material_name TEXT, cost_type TEXT, cost_amount NUMERIC, quantity NUMERIC
  );

  SELECT
    COALESCE(SUM(total_amount) FILTER (WHERE cost_type = 'material'), 0),
    COALESCE(SUM(total_amount) FILTER (WHERE cost_type = 'lab'), 0)
  INTO v_material_total, v_lab_total
  FROM public.patient_material_costs
  WHERE audit_log_id = p_audit_log_id;

  SELECT
    COALESCE(string_agg(material_name, ', ' ORDER BY created_at) FILTER (WHERE cost_type = 'material'), ''),
    COALESCE(string_agg(material_name, ', ' ORDER BY created_at) FILTER (WHERE cost_type = 'lab'), '')
  INTO v_material_names, v_lab_names
  FROM public.patient_material_costs
  WHERE audit_log_id = p_audit_log_id;

  DELETE FROM public.expenses
  WHERE source_id = p_audit_log_id
    AND source_type IN ('material_cost', 'lab_cost');

  IF v_material_total > 0 THEN
    INSERT INTO public.expenses (
      location_id, description, amount, category, date, source_type, source_id, is_system_generated
    ) VALUES (
      v_location_id, 'Material cost - ' || v_patient_name || ' - ' || v_treatment_label || CASE WHEN v_material_names <> '' THEN ' (' || v_material_names || ')' ELSE '' END, v_material_total, 'Material Cost', v_treatment_date,
      'material_cost', p_audit_log_id, true
    );
  END IF;

  IF v_lab_total > 0 THEN
    INSERT INTO public.expenses (
      location_id, description, amount, category, date, source_type, source_id, is_system_generated
    ) VALUES (
      v_location_id, 'Lab cost - ' || v_patient_name || ' - ' || v_treatment_label || CASE WHEN v_lab_names <> '' THEN ' (' || v_lab_names || ')' ELSE '' END, v_lab_total, 'Lab Cost', v_treatment_date,
      'lab_cost', p_audit_log_id, true
    );
  END IF;

  INSERT INTO public.pending_commission_recalculations (patient_id, request_token, requested_at)
  VALUES (v_patient_id, p_request_token, NOW())
  ON CONFLICT (patient_id) DO UPDATE
  SET request_token = EXCLUDED.request_token, requested_at = EXCLUDED.requested_at;

  RETURN QUERY
  SELECT costs.*
  FROM public.patient_material_costs AS costs
  WHERE costs.audit_log_id = p_audit_log_id
  ORDER BY costs.created_at, costs.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_commission_recalculation(
  p_patient_id UUID, p_request_token UUID, p_admin_user_id UUID, p_admin_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_admin_user_id AND u.role = 'admin'
      AND (
        u.password = p_admin_password OR btrim(u.password) = btrim(p_admin_password)
        OR EXISTS (
          SELECT 1 FROM public.staff_auth_sessions s
          WHERE s.user_id = u.id AND s.session_token::TEXT = btrim(p_admin_password)
            AND s.revoked_at IS NULL AND s.expires_at > NOW()
        )
      )
  ) THEN
    RAISE EXCEPTION 'A valid administrator session is required.';
  END IF;

  DELETE FROM public.pending_commission_recalculations
  WHERE patient_id = p_patient_id AND request_token = p_request_token;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_treatment_costs(UUID, JSONB, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_treatment_costs(UUID, JSONB, UUID, TEXT, UUID) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.acknowledge_commission_recalculation(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acknowledge_commission_recalculation(UUID, UUID, UUID, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT
  to_regprocedure('public.replace_treatment_costs(uuid,jsonb,uuid,text,uuid)') IS NOT NULL AS replacement_rpc_ready,
  to_regprocedure('public.acknowledge_commission_recalculation(uuid,uuid,uuid,text)') IS NOT NULL AS commission_ack_rpc_ready,
  to_regprocedure('public.authenticate_staff_user_session(text,text)') IS NOT NULL AS staff_session_auth_rpc_ready,
  to_regprocedure('public.revoke_staff_auth_session(text)') IS NOT NULL AS staff_session_revoke_rpc_ready;