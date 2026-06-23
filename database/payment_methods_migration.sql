-- ============================================================================
-- PAYMENT METHODS + SHARED PAYMENT AUDIT MIGRATION
-- Run once in the Supabase SQL Editor before deploying the matching app build.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS payment_receipt_seq START 1;

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  original_amount DECIMAL(12,2) NOT NULL CHECK (original_amount > 0),
  cleared_amount DECIMAL(12,2) NOT NULL CHECK (cleared_amount > 0),
  balance_before DECIMAL(12,2) NOT NULL CHECK (balance_before >= 0),
  remaining_balance DECIMAL(12,2) NOT NULL CHECK (remaining_balance >= 0),
  payment_method VARCHAR(30) NOT NULL CHECK (
    payment_method IN ('KPAY', 'WAVEPAY', 'CASH', 'MMQR', 'DEBIT_CARD', 'CREDIT_CARD', 'AYA_PAY', 'UAB_PAY')
  ),
  payment_status VARCHAR(10) NOT NULL CHECK (payment_status IN ('FULL', 'PARTIAL')),
  treatment_ids UUID[] NOT NULL DEFAULT '{}',
  receipt_number VARCHAR(40) NOT NULL UNIQUE DEFAULT (
    'REC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(nextval('payment_receipt_seq')::TEXT, 6, '0')
  ),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_snapshot JSONB,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_location_date ON payments(location_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_patient_date ON payments(patient_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_method_date ON payments(payment_method, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_full_access_payments" ON payments;
CREATE POLICY "anon_full_access_payments" ON payments
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION process_patient_payment(
  p_patient_id UUID,
  p_amount DECIMAL,
  p_payment_method TEXT,
  p_treatment_ids UUID[] DEFAULT '{}',
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_receipt_snapshot JSONB DEFAULT NULL,
  p_created_by_user_id UUID DEFAULT NULL,
  p_created_by_user_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  location_id UUID,
  patient_id UUID,
  patient_name TEXT,
  amount DECIMAL,
  original_amount DECIMAL,
  cleared_amount DECIMAL,
  balance_before DECIMAL,
  remaining_balance DECIMAL,
  payment_method VARCHAR,
  payment_status VARCHAR,
  treatment_ids UUID[],
  receipt_number VARCHAR,
  payment_date DATE,
  receipt_snapshot JSONB,
  created_by_user_id UUID,
  created_by_user_name VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient patients%ROWTYPE;
  v_payment payments%ROWTYPE;
  v_method TEXT := UPPER(BTRIM(COALESCE(p_payment_method, '')));
  v_amount DECIMAL(12,2) := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
  v_balance_before DECIMAL(12,2);
  v_created_by_user_id UUID;
  v_service_fee_amount DECIMAL(12,2) := ROUND(COALESCE(NULLIF(BTRIM(COALESCE(p_receipt_snapshot #>> '{payment,serviceFeeAmount}', '')), ''), '0')::NUMERIC, 2);
BEGIN
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than 0';
  END IF;

  IF v_service_fee_amount < 0 THEN
    RAISE EXCEPTION 'Service fee amount cannot be negative';
  END IF;

  IF v_method NOT IN ('KPAY', 'WAVEPAY', 'CASH', 'MMQR', 'DEBIT_CARD', 'CREDIT_CARD', 'AYA_PAY', 'UAB_PAY') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  SELECT *
  INTO v_patient
  FROM patients
  WHERE patients.id = p_patient_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;

  IF (COALESCE(v_patient.balance, 0) + v_service_fee_amount) <= 0 THEN
    RAISE EXCEPTION 'Patient has no outstanding balance';
  END IF;

  IF v_amount > (COALESCE(v_patient.balance, 0) + v_service_fee_amount) THEN
    RAISE EXCEPTION 'Payment amount cannot exceed the outstanding balance';
  END IF;

  v_balance_before := ROUND((COALESCE(v_patient.balance, 0) + v_service_fee_amount)::NUMERIC, 2);

  SELECT users.id
  INTO v_created_by_user_id
  FROM users
  WHERE users.id = p_created_by_user_id;

  UPDATE patients
  SET balance = ROUND((v_balance_before - v_amount)::NUMERIC, 2)
  WHERE patients.id = p_patient_id
  RETURNING * INTO v_patient;

  INSERT INTO payments (
    location_id,
    patient_id,
    amount,
    original_amount,
    cleared_amount,
    balance_before,
    remaining_balance,
    payment_method,
    payment_status,
    treatment_ids,
    payment_date,
    receipt_snapshot,
    created_by_user_id,
    created_by_user_name
  )
  VALUES (
    v_patient.location_id,
    v_patient.id,
    v_amount,
    v_amount,
    v_amount,
    v_balance_before,
    COALESCE(v_patient.balance, 0),
    v_method,
    CASE WHEN COALESCE(v_patient.balance, 0) = 0 THEN 'FULL' ELSE 'PARTIAL' END,
    COALESCE(p_treatment_ids, '{}'),
    COALESCE(p_payment_date, CURRENT_DATE),
    p_receipt_snapshot,
    v_created_by_user_id,
    NULLIF(BTRIM(COALESCE(p_created_by_user_name, '')), '')
  )
  RETURNING * INTO v_payment;

  RETURN QUERY
  SELECT
    v_payment.id,
    v_payment.location_id,
    v_payment.patient_id,
    v_patient.name::TEXT,
    v_payment.amount,
    v_payment.original_amount,
    v_payment.cleared_amount,
    v_payment.balance_before,
    v_payment.remaining_balance,
    v_payment.payment_method,
    v_payment.payment_status,
    v_payment.treatment_ids,
    v_payment.receipt_number,
    v_payment.payment_date,
    v_payment.receipt_snapshot,
    v_payment.created_by_user_id,
    v_payment.created_by_user_name,
    v_payment.created_at;
END;
$$;

REVOKE ALL ON FUNCTION process_patient_payment(UUID, DECIMAL, TEXT, UUID[], DATE, JSONB, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_patient_payment(UUID, DECIMAL, TEXT, UUID[], DATE, JSONB, UUID, TEXT) TO anon, authenticated;

SELECT 'Payment methods migration complete' AS status;
