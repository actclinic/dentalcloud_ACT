-- Move new MLS entries from treatment rows to individual payment records.
-- Existing treatment-linked rows remain readable for historical compatibility.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.replace_payment_costs(
  p_audit_log_id UUID,
  p_items JSONB,
  p_user_id UUID,
  p_session_token TEXT,
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
  v_special_doctor_total NUMERIC(12,2);
  v_actor_username TEXT;
  v_location_id UUID;
  v_payment_date DATE;
  v_patient_id UUID;
  v_patient_name TEXT;
  v_receipt_number TEXT;
  v_material_names TEXT;
  v_lab_names TEXT;
  v_special_doctor_names TEXT;
BEGIN
  SELECT pay.location_id, pay.payment_date, pay.patient_id,
         COALESCE(patient.name, 'Unknown patient'), COALESCE(pay.receipt_number, pay.id::TEXT)
  INTO v_location_id, v_payment_date, v_patient_id, v_patient_name, v_receipt_number
  FROM public.audit_logs AS audit
  JOIN public.payments AS pay ON pay.id = audit.source_id
  LEFT JOIN public.patients AS patient ON patient.id = pay.patient_id
  WHERE audit.id = p_audit_log_id AND audit.source_type = 'payment'
  FOR UPDATE OF audit, pay;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment audit row was not found.'; END IF;

  SELECT users.username INTO v_actor_username
  FROM public.users AS users
  JOIN public.staff_auth_sessions AS sessions ON sessions.user_id = users.id
  WHERE users.id = p_user_id
    AND sessions.session_token::TEXT = btrim(COALESCE(p_session_token, ''))
    AND sessions.revoked_at IS NULL AND sessions.expires_at > NOW()
    AND (users.role = 'admin' OR (
      users.role = 'normal' AND users.doctor_id IS NULL
      AND jsonb_typeof(users.allowed_tabs) = 'array'
      AND users.allowed_tabs ? 'material-cost'
      AND (users.location_id IS NULL OR users.location_id = v_location_id)
    ));
  IF NOT FOUND THEN RAISE EXCEPTION 'A valid staff session with MLS Costs permission is required.'; END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'Cost items must be a JSON array.'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS item(material_name TEXT, cost_type TEXT, cost_amount NUMERIC, quantity NUMERIC)
    WHERE btrim(COALESCE(item.material_name, '')) = ''
       OR item.cost_type NOT IN ('material', 'lab', 'special_doctor')
       OR item.cost_amount IS NULL OR item.cost_amount <= 0
       OR item.quantity IS NULL OR item.quantity <= 0
  ) THEN RAISE EXCEPTION 'Every MLS item requires a name, type, positive cost, and positive quantity.'; END IF;

  DELETE FROM public.patient_material_costs WHERE audit_log_id = p_audit_log_id;
  INSERT INTO public.patient_material_costs(audit_log_id, material_name, cost_type, cost_amount, quantity, created_by, created_by_name)
  SELECT p_audit_log_id, btrim(item.material_name), item.cost_type, item.cost_amount, item.quantity, p_user_id, v_actor_username
  FROM jsonb_to_recordset(p_items) AS item(material_name TEXT, cost_type TEXT, cost_amount NUMERIC, quantity NUMERIC);

  SELECT
    COALESCE(SUM(total_amount) FILTER (WHERE cost_type = 'material'), 0),
    COALESCE(SUM(total_amount) FILTER (WHERE cost_type = 'lab'), 0),
    COALESCE(SUM(total_amount) FILTER (WHERE cost_type = 'special_doctor'), 0),
    COALESCE(string_agg(material_name, ', ' ORDER BY created_at) FILTER (WHERE cost_type = 'material'), ''),
    COALESCE(string_agg(material_name, ', ' ORDER BY created_at) FILTER (WHERE cost_type = 'lab'), ''),
    COALESCE(string_agg(material_name, ', ' ORDER BY created_at) FILTER (WHERE cost_type = 'special_doctor'), '')
  INTO v_material_total, v_lab_total, v_special_doctor_total, v_material_names, v_lab_names, v_special_doctor_names
  FROM public.patient_material_costs WHERE audit_log_id = p_audit_log_id;

  DELETE FROM public.expenses WHERE source_id = p_audit_log_id AND source_type IN ('material_cost', 'lab_cost', 'special_doctor_cost');
  IF v_material_total > 0 THEN
    INSERT INTO public.expenses(location_id, description, amount, category, date, source_type, source_id, is_system_generated)
    VALUES (v_location_id, 'Material cost - ' || v_patient_name || ' - Payment ' || v_receipt_number || CASE WHEN v_material_names <> '' THEN ' (' || v_material_names || ')' ELSE '' END, v_material_total, 'Material Cost', v_payment_date, 'material_cost', p_audit_log_id, true);
  END IF;
  IF v_lab_total > 0 THEN
    INSERT INTO public.expenses(location_id, description, amount, category, date, source_type, source_id, is_system_generated)
    VALUES (v_location_id, 'Lab cost - ' || v_patient_name || ' - Payment ' || v_receipt_number || CASE WHEN v_lab_names <> '' THEN ' (' || v_lab_names || ')' ELSE '' END, v_lab_total, 'Lab Cost', v_payment_date, 'lab_cost', p_audit_log_id, true);
  END IF;
  IF v_special_doctor_total > 0 THEN
    INSERT INTO public.expenses(location_id, description, amount, category, date, source_type, source_id, is_system_generated)
    VALUES (v_location_id, 'Special doctor cost - ' || v_patient_name || ' - Payment ' || v_receipt_number || CASE WHEN v_special_doctor_names <> '' THEN ' (' || v_special_doctor_names || ')' ELSE '' END, v_special_doctor_total, 'Special Doctor Cost', v_payment_date, 'special_doctor_cost', p_audit_log_id, true);
  END IF;

  INSERT INTO public.pending_commission_recalculations(patient_id, request_token, requested_at)
  VALUES (v_patient_id, p_request_token, NOW())
  ON CONFLICT (patient_id) DO UPDATE SET request_token = EXCLUDED.request_token, requested_at = EXCLUDED.requested_at;

  RETURN QUERY SELECT costs.* FROM public.patient_material_costs AS costs
  WHERE costs.audit_log_id = p_audit_log_id ORDER BY costs.created_at, costs.id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_payment_costs(UUID, JSONB, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_payment_costs(UUID, JSONB, UUID, TEXT, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
