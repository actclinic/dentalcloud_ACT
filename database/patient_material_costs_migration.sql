-- ============================================================================
-- Material Cost Tracking for Clinical Audit Trail
-- ============================================================================
-- Adds a real audit_logs registry table and patient_material_costs detail table.
-- The app currently renders the audit trail from treatments/payments/appointments;
-- audit_logs gives material-cost rows a stable parent FK without changing those
-- existing operational tables.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(40) NOT NULL CHECK (source_type IN ('treatment', 'payment', 'appointment', 'reschedule')),
  source_id UUID NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT audit_logs_source_unique UNIQUE (source_type, source_id),
  CONSTRAINT audit_logs_source_link_check CHECK (
    (source_type = 'treatment' AND treatment_id = source_id)
    OR (source_type = 'payment' AND payment_id = source_id)
    OR (source_type = 'appointment' AND appointment_id = source_id)
    OR source_type = 'reschedule'
  )
);

CREATE TABLE IF NOT EXISTS public.patient_material_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id UUID NOT NULL REFERENCES public.audit_logs(id) ON DELETE CASCADE,
  material_name VARCHAR(255) NOT NULL,
  cost_type VARCHAR(20) NOT NULL DEFAULT 'material' CHECK (cost_type IN ('material', 'lab')),
  cost_amount NUMERIC(12,2) NOT NULL CHECK (cost_amount >= 0),
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_amount NUMERIC(12,2) GENERATED ALWAYS AS (cost_amount * quantity) STORED,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS source_type VARCHAR(40),
ADD COLUMN IF NOT EXISTS source_id UUID,
ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_source_unique
  ON public.expenses (source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_source
  ON public.audit_logs (source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_patient
  ON public.audit_logs (patient_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_doctor
  ON public.audit_logs (doctor_id);

CREATE INDEX IF NOT EXISTS idx_patient_material_costs_audit_log
  ON public.patient_material_costs (audit_log_id);

CREATE INDEX IF NOT EXISTS idx_patient_material_costs_created_by
  ON public.patient_material_costs (created_by);

CREATE INDEX IF NOT EXISTS idx_patient_material_costs_audit_type
  ON public.patient_material_costs (audit_log_id, cost_type);

CREATE INDEX IF NOT EXISTS idx_expenses_source
  ON public.expenses (source_type, source_id);

CREATE OR REPLACE FUNCTION public.delete_audit_log_material_expense()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.expenses
  WHERE source_type IN ('material_cost', 'lab_cost')
    AND source_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS delete_audit_log_material_expense ON public.audit_logs;
CREATE TRIGGER delete_audit_log_material_expense
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.delete_audit_log_material_expense();

DROP TRIGGER IF EXISTS update_audit_logs_updated_at ON public.audit_logs;
CREATE TRIGGER update_audit_logs_updated_at
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_patient_material_costs_updated_at ON public.patient_material_costs;
CREATE TRIGGER update_patient_material_costs_updated_at
  BEFORE UPDATE ON public.patient_material_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_material_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_full_access_audit_logs" ON public.audit_logs;
CREATE POLICY "anon_full_access_audit_logs" ON public.audit_logs
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access_patient_material_costs" ON public.patient_material_costs;
CREATE POLICY "anon_full_access_patient_material_costs" ON public.patient_material_costs
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

COMMIT;
