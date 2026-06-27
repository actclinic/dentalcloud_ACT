-- ============================================================================
-- DENTAL CLOUD - COMPLETE DATABASE INITIALIZATION SCRIPT
-- ============================================================================
-- This script consolidates all database setup for fresh VPS deployment.
-- Run this in your Supabase SQL Editor to set up the database from scratch.
-- 
-- RLS POLICIES: All tables have RLS enabled with permissive policies for the
-- anon role because the application uses its own custom authentication layer
-- (users table with plain-text password comparison) rather than Supabase Auth.
-- The anon key is the only credential used by the app's supabase client.
-- If you integrate Supabase Auth in the future, tighten these policies.
-- 
-- IMPORTANT: This script also ensures the auth.users table exists with all
-- required columns for Supabase Auth (GoTrue). Self-hosted Supabase's GoTrue
-- container creates the auth schema and tables automatically on startup, but
-- if it starts before the database is fully ready the auth.users migration may
-- be skipped, causing "relation auth.users does not exist" or "column
-- user.confirmed_at does not exist" errors. Section 9 below idempotently
-- creates and repairs auth.users to prevent this.
-- ============================================================================

-- ============================================================================
-- 1. ENABLE NECESSARY EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. DROP EXISTING TABLES (CLEAN INSTALL)
-- ============================================================================
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS medicine_sales CASCADE;
DROP TABLE IF EXISTS medicines CASCADE;
DROP TABLE IF EXISTS scheduled_tasks CASCADE;
DROP TABLE IF EXISTS assistant_memory CASCADE;
DROP TABLE IF EXISTS otp_codes CASCADE;
DROP TABLE IF EXISTS patient_auth CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS treatments CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS doctor_schedules CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS treatment_types CASCADE;
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
DROP TABLE IF EXISTS loyalty_rules CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;

-- ============================================================================
-- 3. CORE TABLES
-- ============================================================================

-- Locations (Multi-tenancy support)
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Global App Settings (singleton row)
CREATE TABLE app_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  
  -- S3-compatible storage settings (for AWS S3, MinIO, R2, etc.)
  s3_url TEXT,
  s3_access_key TEXT,
  s3_secret_key TEXT,
  s3_region TEXT,
  
  -- Supabase Storage REST API settings (recommended)
  storage_url TEXT,
  storage_anon_key TEXT,
  storage_service_key TEXT,
  storage_bucket TEXT,
  clinical_fee_enabled BOOLEAN DEFAULT FALSE,
  clinical_fee_amount DECIMAL(12,2) DEFAULT 0 CHECK (clinical_fee_amount >= 0),
  clinical_fee_default_apply_on_registration BOOLEAN DEFAULT FALSE,
  clinical_fee_new_patient_amount DECIMAL(12,2) DEFAULT 0 CHECK (clinical_fee_new_patient_amount >= 0),
  clinical_fee_returning_patient_amount DECIMAL(12,2) DEFAULT 0 CHECK (clinical_fee_returning_patient_amount >= 0),
  
  -- Custom app name (defaults to "DentalCloud Pro")
  app_name VARCHAR(255) DEFAULT 'DentalCloud Pro',
  app_logo_url TEXT,
  app_logo_path TEXT,
  receipt_email TEXT,
  receipt_phone TEXT,
  receipt_header_title TEXT,
  currency_unit VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency_unit IN ('USD', 'MMK')),
  receipt_size VARCHAR(20) NOT NULL DEFAULT 'A4' CHECK (receipt_size IN ('A4', 'THERMAL_55MM')),

  -- Shared Email Delivery settings (Settings > Email)
  -- Stored centrally so all devices use the same sender/delivery configuration.
  email_delivery_enabled BOOLEAN DEFAULT FALSE,
  email_sender_name TEXT DEFAULT 'DentalCloud',
  email_sender_email TEXT,
  email_message_notifications_enabled BOOLEAN DEFAULT TRUE,
  email_settings_updated_at TIMESTAMP WITH TIME ZONE,
  hover_theme TEXT NOT NULL DEFAULT 'blue' CHECK (hover_theme IN ('blue', 'green', 'yellow', 'brown', 'dark')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users (Staff/Admin accounts)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'normal' CHECK (role IN ('admin', 'normal')),
  allowed_tabs JSONB NOT NULL DEFAULT '["dashboard","patients","appointments","doctors","finance","ai-assistant"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patients
CREATE TABLE patient_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO patient_types (name, sort_order, is_active)
VALUES
  ('Walk-in', 0, true),
  ('ONP', 1, true),
  ('RNP', 2, true),
  ('OTP', 3, true),
  ('Hotline', 4, true),
  ('Rec-ph call', 5, true),
  ('Tiktok', 6, true),
  ('Tiktok Hotline', 7, true)
ON CONFLICT (name) DO NOTHING;

-- Sequence for auto-generating patient_unique_id
CREATE SEQUENCE IF NOT EXISTS patient_id_seq START 1;

CREATE TABLE patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_unique_id VARCHAR(20) UNIQUE NOT NULL DEFAULT 'PAT-' || LPAD(nextval('patient_id_seq'::regclass)::TEXT, 5, '0'),
  location_id UUID REFERENCES locations(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  age INTEGER,
  address TEXT,
  city VARCHAR(100),
  township VARCHAR(100),
  patient_type VARCHAR(100) DEFAULT 'Walk-in',
  balance DECIMAL(12,2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  medical_history TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patient Authentication
CREATE TABLE patient_auth (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  username VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  password VARCHAR(255),
  is_verified BOOLEAN DEFAULT false,
  supabase_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OTP Codes for verification
CREATE TABLE otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE appointment_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO appointment_types (name, sort_order, is_active)
VALUES
  ('Consult', 0, true),
  ('Check Up', 1, true)
ON CONFLICT (name) DO NOTHING;

-- Doctors
CREATE TABLE doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  specialization VARCHAR(255),
  password VARCHAR(255),
  commission_percentage DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Doctor Schedules
ALTER TABLE doctors ADD CONSTRAINT doctors_commission_percentage_check CHECK (commission_percentage >= 0 AND commission_percentage <= 100);
CREATE TABLE doctor_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link optional doctor login accounts to users (one doctor -> one staff login)
ALTER TABLE users
ADD COLUMN doctor_id UUID
  CONSTRAINT users_doctor_id_fkey REFERENCES doctors(id) ON DELETE SET NULL;

-- Treatment Types (Services/Procedures)
CREATE TABLE treatment_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(255) NOT NULL,
  cost DECIMAL(12,2) NOT NULL,
  category VARCHAR(50),
  color VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Treatments (Patient treatment records)
CREATE TABLE treatments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  teeth INTEGER[],
  description TEXT,
  cost DECIMAL(12,2),
  standard_cost DECIMAL(12,2),
  discount_amount DECIMAL(12,2) DEFAULT 0,
  pricing_note VARCHAR(20),
  doctor_earnings DECIMAL(12,2) DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT treatments_standard_cost_check CHECK (standard_cost IS NULL OR standard_cost >= 0),
  CONSTRAINT treatments_discount_amount_check CHECK (discount_amount >= 0),
  CONSTRAINT treatments_pricing_note_check CHECK (pricing_note IS NULL OR pricing_note IN ('FOC', 'DISCOUNT')),
  CONSTRAINT treatments_doctor_earnings_check CHECK (doctor_earnings >= 0)
);

CREATE SEQUENCE IF NOT EXISTS payment_receipt_seq START 1;

CREATE TABLE payments (
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

-- Doctor Treatment Commissions
CREATE TABLE doctor_treatment_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL
    CONSTRAINT doctor_treatment_commissions_treatment_id_fkey
    REFERENCES treatment_types(id) ON DELETE CASCADE,
  commission_rate DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doctor_treatment_commissions_doctor_treatment_key UNIQUE (doctor_id, treatment_id),
  CONSTRAINT doctor_treatment_commissions_commission_rate_check CHECK (commission_rate >= 0 AND commission_rate <= 100)
);

CREATE INDEX idx_doctor_treatment_commissions_doctor_id
  ON doctor_treatment_commissions (doctor_id);

CREATE INDEX idx_doctor_treatment_commissions_treatment_id
  ON doctor_treatment_commissions (treatment_id);

-- Appointments
CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_name VARCHAR(255),
  guest_name VARCHAR(255),
  guest_phone VARCHAR(50),
  guest_source VARCHAR(50),
  guest_notes TEXT,
  converted_patient_id UUID,
  date DATE NOT NULL,
  time TIME NOT NULL,
  type VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Scheduled',
  notes TEXT,
  clinical_fee_status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (clinical_fee_status IN ('PENDING', 'APPLIED', 'SKIPPED', 'NOT_APPLICABLE')),
  clinical_fee_amount DECIMAL(12,2) DEFAULT 0 CHECK (clinical_fee_amount >= 0),
  clinical_fee_patient_category VARCHAR(20)
    CHECK (clinical_fee_patient_category IS NULL OR clinical_fee_patient_category IN ('NEW', 'RETURNING')),
  clinical_fee_applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT appointments_registered_or_guest_check CHECK (
    patient_id IS NOT NULL
    OR (
      NULLIF(BTRIM(COALESCE(guest_name, '')), '') IS NOT NULL
      AND NULLIF(BTRIM(COALESCE(guest_phone, '')), '') IS NOT NULL
    )
  )
);

ALTER TABLE appointments
ADD CONSTRAINT appointments_converted_patient_id_fkey
FOREIGN KEY (converted_patient_id) REFERENCES patients(id) ON DELETE SET NULL;

ALTER TABLE appointments
DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;

ALTER TABLE appointments
ADD CONSTRAINT appointments_patient_id_fkey
FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL;

CREATE TABLE appointment_reschedule_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(255) NOT NULL,
  doctor_name VARCHAR(255),
  original_date DATE NOT NULL,
  new_date DATE NOT NULL,
  reason TEXT NOT NULL,
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Medicines (Inventory)
CREATE TABLE medicines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50) DEFAULT 'pack',
  item_type VARCHAR(20) DEFAULT 'Medicine' CHECK (item_type IN ('Medicine', 'Retail', 'Supply', 'Other')),
  price DECIMAL(12,2) DEFAULT 0,
  stock DECIMAL(12,2) DEFAULT 0,
  min_stock DECIMAL(12,2) DEFAULT 0,
  quantity_step DECIMAL(12,2) DEFAULT 1 CHECK (quantity_step > 0),
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medicine Sales
CREATE TABLE medicine_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicines(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  treatment_id UUID REFERENCES treatments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loyalty Rules
CREATE TABLE loyalty_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) CHECK (event_type IN ('TREATMENT', 'PURCHASE', 'VISIT', 'REDEEM')),
  points_per_unit DECIMAL(12,4) NOT NULL,
  min_amount DECIMAL(12,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loyalty Transactions
CREATE TABLE loyalty_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  points INTEGER NOT NULL,
  type VARCHAR(20) CHECK (type IN ('EARNED', 'REDEEMED', 'EXPIRED')),
  description TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category VARCHAR(100),
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations (Messaging)
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_user_id UUID
    CONSTRAINT conversations_doctor_user_id_fkey
    REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES users(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT conversations_participant_check CHECK (
    (patient_id IS NOT NULL AND doctor_user_id IS NULL) OR
    (patient_id IS NULL AND doctor_user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_conversations_location_id ON conversations(location_id);

-- Messages (Messaging)
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type VARCHAR(10) CHECK (sender_type IN ('patient', 'admin')) NOT NULL,
  recipient_id UUID NOT NULL,
  recipient_type VARCHAR(10) CHECK (recipient_type IN ('patient', 'admin')) NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_location_id ON messages(location_id);

-- Assistant Memory (per admin)
CREATE TABLE assistant_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES users(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  profile JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(admin_id)
);

-- Scheduled Tasks
CREATE TABLE scheduled_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  task_type VARCHAR(40) NOT NULL CHECK (task_type IN ('EMAIL', 'DAILY_REPORT_EMAIL')),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  run_at TIMESTAMP WITH TIME ZONE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Active staff monitoring with event-based login/logout presence updates.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'active_staff_sessions'
      AND column_name = 'last_heartbeat'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'active_staff_sessions'
      AND column_name = 'last_seen'
  ) THEN
    ALTER TABLE active_staff_sessions RENAME COLUMN last_heartbeat TO last_seen;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS active_staff_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username_snapshot VARCHAR(255) NOT NULL,
  role_snapshot VARCHAR(20) NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT active_staff_sessions_role_check CHECK (role_snapshot IN ('admin', 'normal', 'doctor'))
);

ALTER TABLE active_staff_sessions
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE active_staff_sessions
  DROP CONSTRAINT IF EXISTS active_staff_sessions_role_check;

ALTER TABLE active_staff_sessions
  ADD CONSTRAINT active_staff_sessions_role_check
  CHECK (role_snapshot IN ('admin', 'normal', 'doctor'));

CREATE INDEX IF NOT EXISTS idx_active_staff_sessions_user_id
ON active_staff_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_active_staff_sessions_last_seen
ON active_staff_sessions(last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_active_staff_sessions_location_id
ON active_staff_sessions(location_id);

ALTER TABLE active_staff_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_full_access_active_staff_sessions" ON active_staff_sessions;
CREATE POLICY "anon_full_access_active_staff_sessions" ON active_staff_sessions
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION cleanup_stale_active_staff_sessions(
  p_cutoff_minutes INTEGER DEFAULT 60
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM active_staff_sessions
  WHERE last_seen < NOW() - make_interval(mins => GREATEST(p_cutoff_minutes, 1));
END;
$$;

CREATE OR REPLACE FUNCTION upsert_active_staff_session_presence(
  p_session_id TEXT,
  p_user_id UUID,
  p_username TEXT,
  p_role TEXT,
  p_location_id UUID DEFAULT NULL,
  p_login_at TIMESTAMPTZ DEFAULT NOW(),
  p_seen_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM cleanup_stale_active_staff_sessions(60);

  INSERT INTO active_staff_sessions (
    session_id,
    user_id,
    username_snapshot,
    role_snapshot,
    location_id,
    login_at,
    last_seen,
    created_at,
    updated_at
  )
  VALUES (
    p_session_id,
    p_user_id,
    p_username,
    CASE
      WHEN LOWER(COALESCE(p_role, 'normal')) = 'admin' THEN 'admin'
      WHEN LOWER(COALESCE(p_role, 'normal')) = 'doctor' THEN 'doctor'
      ELSE 'normal'
    END,
    p_location_id,
    COALESCE(p_login_at, NOW()),
    COALESCE(p_seen_at, NOW()),
    NOW(),
    NOW()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    username_snapshot = EXCLUDED.username_snapshot,
    role_snapshot = EXCLUDED.role_snapshot,
    location_id = EXCLUDED.location_id,
    login_at = EXCLUDED.login_at,
    last_seen = EXCLUDED.last_seen,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE VIEW active_staff_presence_view AS
SELECT
  ass.session_id::TEXT AS session_id,
  ass.user_id,
  COALESCE(u.username, ass.username_snapshot)::TEXT AS username,
  ass.role_snapshot::TEXT AS role,
  COALESCE(u.location_id, ass.location_id) AS location_id,
  loc.name::TEXT AS location_name,
  CASE
    WHEN ass.role_snapshot = 'doctor' THEN COALESCE(d.name, u.username, ass.username_snapshot)
    ELSE COALESCE(u.username, ass.username_snapshot)
  END::TEXT AS display_name,
  CASE
    WHEN ass.role_snapshot = 'doctor' THEN d.email
    ELSE NULL
  END::TEXT AS email,
  CASE
    WHEN ass.role_snapshot = 'doctor' THEN d.phone
    ELSE NULL
  END::TEXT AS phone,
  ass.login_at,
  ass.last_seen
FROM active_staff_sessions ass
LEFT JOIN users u
  ON u.id = ass.user_id
LEFT JOIN doctors d
  ON d.id = u.doctor_id
LEFT JOIN locations loc
  ON loc.id = COALESCE(u.location_id, ass.location_id);

CREATE OR REPLACE FUNCTION clear_active_staff_session_presence(
  p_session_id TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM active_staff_sessions
  WHERE session_id = p_session_id;

  PERFORM cleanup_stale_active_staff_sessions(60);
END;
$$;

CREATE OR REPLACE FUNCTION update_and_get_staff_presence(
  p_session_id TEXT,
  p_user_id UUID,
  p_username TEXT,
  p_role TEXT,
  p_location_id UUID DEFAULT NULL,
  p_login_at TIMESTAMPTZ DEFAULT NOW(),
  p_seen_at TIMESTAMPTZ DEFAULT NOW(),
  p_cutoff_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  session_id TEXT,
  user_id UUID,
  username TEXT,
  role TEXT,
  location_id UUID,
  location_name TEXT,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  login_at TIMESTAMPTZ,
  last_seen TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF NULLIF(BTRIM(COALESCE(p_session_id, '')), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTIVE_STAFF_INVALID_SESSION_ID';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTIVE_STAFF_INVALID_USER_ID';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_username, '')), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTIVE_STAFF_INVALID_USERNAME';
  END IF;

  PERFORM upsert_active_staff_session_presence(
    p_session_id,
    p_user_id,
    p_username,
    p_role,
    p_location_id,
    p_login_at,
    p_seen_at
  );

  PERFORM cleanup_stale_active_staff_sessions(GREATEST(COALESCE(p_cutoff_minutes, 60), 1));

  RETURN QUERY
  WITH active_sessions AS (
    SELECT DISTINCT ON (ass.user_id)
      ass.session_id,
      ass.user_id,
      ass.username_snapshot,
      ass.role_snapshot,
      ass.location_id,
      ass.login_at,
      ass.last_seen
    FROM active_staff_sessions ass
    WHERE ass.last_seen >= NOW() - make_interval(mins => GREATEST(COALESCE(p_cutoff_minutes, 60), 1))
    ORDER BY ass.user_id, ass.last_seen DESC
  )
  SELECT
    active_sessions.session_id::TEXT,
    active_sessions.user_id,
    COALESCE(u.username, active_sessions.username_snapshot)::TEXT,
    active_sessions.role_snapshot::TEXT,
    COALESCE(u.location_id, active_sessions.location_id),
    loc.name::TEXT,
    CASE
      WHEN active_sessions.role_snapshot = 'doctor' THEN COALESCE(d.name, u.username, active_sessions.username_snapshot)
      ELSE COALESCE(u.username, active_sessions.username_snapshot)
    END::TEXT,
    CASE
      WHEN active_sessions.role_snapshot = 'doctor' THEN d.email
      ELSE NULL
    END::TEXT,
    CASE
      WHEN active_sessions.role_snapshot = 'doctor' THEN d.phone
      ELSE NULL
    END::TEXT,
    active_sessions.login_at,
    active_sessions.last_seen
  FROM active_sessions
  LEFT JOIN users u ON u.id = active_sessions.user_id
  LEFT JOIN doctors d ON d.id = u.doctor_id
  LEFT JOIN locations loc ON loc.id = COALESCE(u.location_id, active_sessions.location_id)
  ORDER BY active_sessions.last_seen DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_stale_active_staff_sessions(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_active_staff_session_presence(TEXT, UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION clear_active_staff_session_presence(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_and_get_staff_presence(TEXT, UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO anon, authenticated;
GRANT SELECT ON active_staff_presence_view TO anon, authenticated;

-- ============================================================================
-- 3.1 COMPATIBILITY UPDATES (KEEP THIS FILE SELF-CONTAINED)
-- ============================================================================
-- If this file is edited over time, these idempotent statements help ensure
-- newer app_settings columns exist even if table definitions drift.
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS receipt_email TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS receipt_phone TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS receipt_header_title TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS currency_unit VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS receipt_size VARCHAR(20) NOT NULL DEFAULT 'A4';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS clinical_fee_default_apply_on_registration BOOLEAN DEFAULT FALSE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS clinical_fee_new_patient_amount DECIMAL(12,2);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS clinical_fee_returning_patient_amount DECIMAL(12,2);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_delivery_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_sender_name TEXT DEFAULT 'DentalCloud';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_sender_email TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_message_notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_settings_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS app_logo_url TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS app_logo_path TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS hover_theme TEXT NOT NULL DEFAULT 'blue';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinical_fee_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinical_fee_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinical_fee_patient_category VARCHAR(20);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinical_fee_applied_at TIMESTAMP WITH TIME ZONE;

UPDATE app_settings
SET
  currency_unit = CASE WHEN currency_unit IN ('USD', 'MMK') THEN currency_unit ELSE 'USD' END,
  receipt_size = CASE WHEN receipt_size IN ('A4', 'THERMAL_55MM') THEN receipt_size ELSE 'A4' END,
  clinical_fee_default_apply_on_registration = COALESCE(clinical_fee_default_apply_on_registration, clinical_fee_enabled, FALSE),
  clinical_fee_new_patient_amount = COALESCE(clinical_fee_new_patient_amount, clinical_fee_amount, 0),
  clinical_fee_returning_patient_amount = COALESCE(clinical_fee_returning_patient_amount, clinical_fee_amount, 0);

UPDATE appointments
SET
  clinical_fee_status = CASE
    WHEN status = 'Completed' AND COALESCE(clinical_fee_status, 'PENDING') = 'PENDING' THEN 'NOT_APPLICABLE'
    ELSE COALESCE(clinical_fee_status, 'PENDING')
  END,
  clinical_fee_amount = COALESCE(clinical_fee_amount, 0);

ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_clinical_fee_amount_check,
  ALTER COLUMN clinical_fee_new_patient_amount SET DEFAULT 0,
  ALTER COLUMN clinical_fee_returning_patient_amount SET DEFAULT 0,
  DROP CONSTRAINT IF EXISTS app_settings_clinical_fee_new_patient_amount_check,
  DROP CONSTRAINT IF EXISTS app_settings_clinical_fee_returning_patient_amount_check;

ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_clinical_fee_amount_check
    CHECK (clinical_fee_amount >= 0),
  ADD CONSTRAINT app_settings_clinical_fee_new_patient_amount_check
    CHECK (clinical_fee_new_patient_amount >= 0),
  ADD CONSTRAINT app_settings_clinical_fee_returning_patient_amount_check
    CHECK (clinical_fee_returning_patient_amount >= 0);

ALTER TABLE medicines
  DROP CONSTRAINT IF EXISTS medicines_item_type_check,
  DROP CONSTRAINT IF EXISTS medicines_quantity_step_check;

ALTER TABLE medicines
  ADD CONSTRAINT medicines_item_type_check
    CHECK (item_type IN ('Medicine', 'Retail', 'Supply', 'Other')),
  ADD CONSTRAINT medicines_quantity_step_check
    CHECK (quantity_step > 0);

ALTER TABLE medicine_sales
  DROP CONSTRAINT IF EXISTS medicine_sales_quantity_check;

ALTER TABLE medicine_sales
  ADD CONSTRAINT medicine_sales_quantity_check
    CHECK (quantity > 0);

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_balance_before_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_balance_before_check
    CHECK (balance_before >= 0);

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_clinical_fee_status_check,
  DROP CONSTRAINT IF EXISTS appointments_clinical_fee_amount_check,
  DROP CONSTRAINT IF EXISTS appointments_clinical_fee_patient_category_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_clinical_fee_status_check
    CHECK (clinical_fee_status IN ('PENDING', 'APPLIED', 'SKIPPED', 'NOT_APPLICABLE')),
  ADD CONSTRAINT appointments_clinical_fee_amount_check
    CHECK (clinical_fee_amount >= 0),
  ADD CONSTRAINT appointments_clinical_fee_patient_category_check
    CHECK (
      clinical_fee_patient_category IS NULL
      OR clinical_fee_patient_category IN ('NEW', 'RETURNING')
    );

CREATE INDEX IF NOT EXISTS idx_appointments_patient_completed_visit
  ON appointments (patient_id, date, time)
  WHERE status = 'Completed';

ALTER TABLE app_settings
  ALTER COLUMN currency_unit SET DEFAULT 'USD',
  ALTER COLUMN currency_unit SET NOT NULL,
  ALTER COLUMN receipt_size SET DEFAULT 'A4',
  ALTER COLUMN receipt_size SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_hover_theme_check'
  ) THEN
    ALTER TABLE app_settings
    ADD CONSTRAINT app_settings_hover_theme_check
    CHECK (hover_theme IN ('blue', 'green', 'yellow', 'brown', 'dark'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_currency_unit_check'
  ) THEN
    ALTER TABLE app_settings
    ADD CONSTRAINT app_settings_currency_unit_check
    CHECK (currency_unit IN ('USD', 'MMK'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_receipt_size_check'
  ) THEN
    ALTER TABLE app_settings
    ADD CONSTRAINT app_settings_receipt_size_check
    CHECK (receipt_size IN ('A4', 'THERMAL_55MM'));
  END IF;
END $$;

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_location ON users(location_id);
CREATE UNIQUE INDEX users_doctor_id_unique_idx
ON users(doctor_id)
WHERE doctor_id IS NOT NULL;
CREATE INDEX idx_patient_types_sort_order ON patient_types(sort_order);
CREATE INDEX idx_patient_types_active ON patient_types(is_active);
CREATE INDEX idx_appointment_types_sort_order ON appointment_types(sort_order);
CREATE INDEX idx_appointment_types_active ON appointment_types(is_active);
CREATE INDEX idx_patients_location ON patients(location_id);
CREATE INDEX idx_patients_email ON patients(email);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_patient_unique_id ON patients(patient_unique_id);
CREATE INDEX idx_patients_patient_type ON patients(patient_type);
CREATE INDEX idx_patients_city ON patients(city);
CREATE INDEX idx_patients_township ON patients(township);
CREATE INDEX idx_patient_auth_email ON patient_auth(email);
CREATE INDEX idx_patient_auth_phone ON patient_auth(phone);
CREATE INDEX idx_patient_auth_username ON patient_auth(username);
CREATE INDEX idx_patient_auth_patient_id ON patient_auth(patient_id);
CREATE INDEX idx_patient_auth_location_id ON patient_auth(location_id);
CREATE INDEX idx_patient_auth_supabase_user_id ON patient_auth(supabase_user_id);
CREATE INDEX idx_patient_auth_email_verified ON patient_auth(email, is_verified);
CREATE INDEX idx_patient_auth_username_verified ON patient_auth(username, is_verified);
CREATE INDEX idx_otp_codes_email ON otp_codes(email);
CREATE INDEX idx_otp_codes_expires ON otp_codes(expires_at);
CREATE INDEX idx_otp_codes_email_code_used_expires ON otp_codes(email, code, used, expires_at);
CREATE INDEX idx_doctors_location ON doctors(location_id);
CREATE INDEX idx_doctor_schedules_doctor ON doctor_schedules(doctor_id);
CREATE INDEX idx_treatment_types_location ON treatment_types(location_id);
CREATE INDEX idx_treatments_patient ON treatments(patient_id);
CREATE INDEX idx_treatments_location ON treatments(location_id);
CREATE INDEX idx_treatments_doctor ON treatments(doctor_id);
CREATE INDEX idx_treatments_date ON treatments(date);
CREATE INDEX idx_payments_location_date ON payments(location_id, payment_date DESC);
CREATE INDEX idx_payments_patient_date ON payments(patient_id, payment_date DESC);
CREATE INDEX idx_payments_method_date ON payments(payment_method, payment_date DESC);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_location ON appointments(location_id);
CREATE INDEX idx_appointments_created_by_user_id ON appointments(created_by_user_id);
CREATE INDEX idx_appointments_created_at ON appointments(created_at);
CREATE INDEX idx_appointments_guest_phone ON appointments(guest_phone);
CREATE INDEX idx_appointments_guest_source ON appointments(guest_source);
CREATE INDEX idx_appointment_reschedule_logs_location_id ON appointment_reschedule_logs(location_id);
CREATE INDEX idx_appointment_reschedule_logs_appointment_id ON appointment_reschedule_logs(appointment_id);
CREATE INDEX idx_appointment_reschedule_logs_created_at ON appointment_reschedule_logs(created_at DESC);
CREATE INDEX idx_medicines_location ON medicines(location_id);
CREATE INDEX idx_medicines_name ON medicines(name);
CREATE INDEX idx_medicines_category ON medicines(category);
CREATE INDEX idx_medicines_item_type ON medicines(item_type);
CREATE INDEX idx_medicine_sales_patient ON medicine_sales(patient_id);
CREATE INDEX idx_medicine_sales_medicine ON medicine_sales(medicine_id);
CREATE INDEX idx_medicine_sales_date ON medicine_sales(date);
CREATE INDEX idx_medicine_sales_treatment ON medicine_sales(treatment_id);
CREATE INDEX idx_loyalty_rules_location ON loyalty_rules(location_id);
CREATE INDEX idx_loyalty_transactions_patient ON loyalty_transactions(patient_id);
CREATE INDEX idx_loyalty_transactions_location ON loyalty_transactions(location_id);
CREATE INDEX idx_expenses_location ON expenses(location_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_conversations_patient_id ON conversations(patient_id);
CREATE INDEX idx_conversations_doctor_user_id ON conversations(doctor_user_id);
CREATE INDEX idx_conversations_admin_id ON conversations(admin_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_recipient ON messages(recipient_id, recipient_type, read);
CREATE UNIQUE INDEX idx_conversations_patient_admin_unique ON conversations(patient_id, admin_id) WHERE patient_id IS NOT NULL;
CREATE UNIQUE INDEX idx_conversations_doctor_admin_unique ON conversations(doctor_user_id, admin_id) WHERE doctor_user_id IS NOT NULL;
CREATE INDEX idx_assistant_memory_admin ON assistant_memory(admin_id);
CREATE INDEX idx_assistant_memory_location ON assistant_memory(location_id);
CREATE INDEX idx_scheduled_tasks_location ON scheduled_tasks(location_id);
CREATE INDEX idx_scheduled_tasks_status_run_at ON scheduled_tasks(status, run_at);

-- ============================================================================
-- 5. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function: Auto-assign patient_unique_id on insert
CREATE OR REPLACE FUNCTION assign_patient_unique_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.patient_unique_id IS NULL THEN
    NEW.patient_unique_id := 'PAT-' || LPAD(nextval('patient_id_seq'::regclass)::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-assign patient_unique_id before insert
DROP TRIGGER IF EXISTS trg_assign_patient_unique_id ON patients;
CREATE TRIGGER trg_assign_patient_unique_id
BEFORE INSERT ON patients
FOR EACH ROW
EXECUTE FUNCTION assign_patient_unique_id();

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
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than 0'; END IF;
  IF v_service_fee_amount < 0 THEN RAISE EXCEPTION 'Service fee amount cannot be negative'; END IF;
  IF v_method NOT IN ('KPAY', 'WAVEPAY', 'CASH', 'MMQR', 'DEBIT_CARD', 'CREDIT_CARD', 'AYA_PAY', 'UAB_PAY') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  SELECT *
  INTO v_patient
  FROM patients
  WHERE patients.id = p_patient_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Patient not found'; END IF;
  IF (COALESCE(v_patient.balance, 0) + v_service_fee_amount) <= 0 THEN RAISE EXCEPTION 'Patient has no outstanding balance'; END IF;
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
    location_id, patient_id, amount, original_amount, cleared_amount, balance_before, remaining_balance,
    payment_method, payment_status, treatment_ids, payment_date, receipt_snapshot,
    created_by_user_id, created_by_user_name
  ) VALUES (
    v_patient.location_id, v_patient.id, v_amount, v_amount, v_amount, v_balance_before, COALESCE(v_patient.balance, 0),
    v_method, CASE WHEN COALESCE(v_patient.balance, 0) = 0 THEN 'FULL' ELSE 'PARTIAL' END,
    COALESCE(p_treatment_ids, '{}'), COALESCE(p_payment_date, CURRENT_DATE), p_receipt_snapshot,
    v_created_by_user_id, NULLIF(BTRIM(COALESCE(p_created_by_user_name, '')), '')
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

CREATE OR REPLACE FUNCTION complete_appointment_with_clinical_fee(
  p_appointment_id UUID,
  p_skip_clinical_fee BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  appointment_id UUID,
  fee_status VARCHAR,
  fee_amount DECIMAL,
  patient_category VARCHAR,
  new_balance DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment appointments%ROWTYPE;
  v_patient patients%ROWTYPE;
  v_settings app_settings%ROWTYPE;
  v_is_returning BOOLEAN := FALSE;
  v_category VARCHAR(20);
  v_fee DECIMAL(12,2) := 0;
  v_fee_status VARCHAR(20) := 'NOT_APPLICABLE';
BEGIN
  SELECT *
  INTO v_appointment
  FROM appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF v_appointment.status = 'Completed'
     AND v_appointment.clinical_fee_status IN ('APPLIED', 'SKIPPED', 'NOT_APPLICABLE') THEN
    SELECT patient.balance
    INTO new_balance
    FROM patients patient
    WHERE patient.id = v_appointment.patient_id;

    appointment_id := v_appointment.id;
    fee_status := v_appointment.clinical_fee_status;
    fee_amount := COALESCE(v_appointment.clinical_fee_amount, 0);
    patient_category := v_appointment.clinical_fee_patient_category;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_appointment.patient_id IS NULL THEN
    UPDATE appointments
    SET
      status = 'Completed',
      clinical_fee_status = 'NOT_APPLICABLE',
      clinical_fee_amount = 0,
      clinical_fee_patient_category = NULL,
      clinical_fee_applied_at = NULL
    WHERE id = v_appointment.id;

    appointment_id := v_appointment.id;
    fee_status := 'NOT_APPLICABLE';
    fee_amount := 0;
    patient_category := NULL;
    new_balance := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT *
  INTO v_patient
  FROM patients
  WHERE id = v_appointment.patient_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;

  SELECT *
  INTO v_settings
  FROM app_settings
  WHERE id = 1;

  SELECT EXISTS (
    SELECT 1
    FROM appointments previous
    WHERE previous.patient_id = v_appointment.patient_id
      AND previous.id <> v_appointment.id
      AND previous.status = 'Completed'
      AND (
        previous.date < v_appointment.date
        OR (previous.date = v_appointment.date AND previous.time < v_appointment.time)
      )
  ) OR EXISTS (
    SELECT 1
    FROM treatments previous_treatment
    WHERE previous_treatment.patient_id = v_appointment.patient_id
      AND previous_treatment.date < v_appointment.date
  )
  INTO v_is_returning;

  v_category := CASE WHEN v_is_returning THEN 'RETURNING' ELSE 'NEW' END;

  IF p_skip_clinical_fee THEN
    v_fee_status := 'SKIPPED';
  ELSIF COALESCE(v_settings.clinical_fee_enabled, FALSE) THEN
    v_fee := CASE
      WHEN v_is_returning THEN COALESCE(v_settings.clinical_fee_returning_patient_amount, 0)
      ELSE COALESCE(v_settings.clinical_fee_new_patient_amount, 0)
    END;

    IF v_fee > 0 THEN
      UPDATE patients
      SET balance = ROUND((COALESCE(balance, 0) + v_fee)::NUMERIC, 2)
      WHERE id = v_patient.id
      RETURNING * INTO v_patient;

      v_fee_status := 'APPLIED';
    END IF;
  END IF;

  UPDATE appointments
  SET
    status = 'Completed',
    clinical_fee_status = v_fee_status,
    clinical_fee_amount = CASE WHEN v_fee_status = 'APPLIED' THEN v_fee ELSE 0 END,
    clinical_fee_patient_category = v_category,
    clinical_fee_applied_at = CASE WHEN v_fee_status = 'APPLIED' THEN NOW() ELSE NULL END
  WHERE id = v_appointment.id;

  appointment_id := v_appointment.id;
  fee_status := v_fee_status;
  fee_amount := CASE WHEN v_fee_status = 'APPLIED' THEN v_fee ELSE 0 END;
  patient_category := v_category;
  new_balance := v_patient.balance;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION complete_appointment_with_clinical_fee(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_appointment_with_clinical_fee(UUID, BOOLEAN) TO anon, authenticated;

-- Generic function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION set_doctor_treatment_commissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_applicable_commission_rate(
  p_doctor_id UUID,
  p_treatment_id UUID
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_custom_rate DECIMAL(5,2);
  v_default_rate DECIMAL(5,2);
BEGIN
  SELECT dtc.commission_rate
  INTO v_custom_rate
  FROM doctor_treatment_commissions dtc
  WHERE dtc.doctor_id = p_doctor_id
    AND dtc.treatment_id = p_treatment_id
  LIMIT 1;

  IF v_custom_rate IS NOT NULL THEN
    RETURN v_custom_rate;
  END IF;

  SELECT COALESCE(d.commission_percentage, 0)
  INTO v_default_rate
  FROM doctors d
  WHERE d.id = p_doctor_id
  LIMIT 1;

  RETURN COALESCE(v_default_rate, 0);
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update users.updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update medicines.updated_at
CREATE TRIGGER update_medicines_updated_at 
    BEFORE UPDATE ON medicines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update expenses.updated_at
CREATE TRIGGER update_expenses_updated_at 
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update doctor_treatment_commissions.updated_at
CREATE TRIGGER trg_doctor_treatment_commissions_updated_at
    BEFORE UPDATE ON doctor_treatment_commissions
    FOR EACH ROW EXECUTE FUNCTION set_doctor_treatment_commissions_updated_at();

-- Trigger: Update patient_auth.updated_at
CREATE TRIGGER update_patient_auth_updated_at 
    BEFORE UPDATE ON patient_auth
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update conversations.updated_at
CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update assistant_memory.updated_at
CREATE TRIGGER update_assistant_memory_updated_at
    BEFORE UPDATE ON assistant_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update scheduled_tasks.updated_at
CREATE TRIGGER update_scheduled_tasks_updated_at
    BEFORE UPDATE ON scheduled_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update app_settings.updated_at
CREATE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Update conversation timestamp when new message is added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NOW(),
        last_message = NEW.content,
        last_message_time = NEW.timestamp
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update conversation on new message
CREATE TRIGGER update_conversation_on_new_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Function: Clean up old messages (older than 2 months)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM messages 
    WHERE timestamp < NOW() - INTERVAL '2 months';
    
    DELETE FROM conversations 
    WHERE id NOT IN (
        SELECT DISTINCT conversation_id 
        FROM messages
    ) 
    AND created_at < NOW() - INTERVAL '2 months';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. INITIAL SEED DATA
-- ============================================================================

-- Default location
INSERT INTO locations (id, name, address, phone)
VALUES ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Main Clinic', '123 Dental St, Yangon', '09-123456789');

-- Default app settings row
INSERT INTO app_settings (
    id,
    email_delivery_enabled,
    email_sender_name,
    email_message_notifications_enabled,
    email_settings_updated_at
)
VALUES (
    1,
    FALSE,
    'DentalCloud',
    TRUE,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Ensure shared app settings defaults are populated if this setup is rerun
-- against an older/drifted database that already had the singleton row.
UPDATE app_settings
SET
    email_delivery_enabled = COALESCE(email_delivery_enabled, FALSE),
    email_sender_name = COALESCE(NULLIF(email_sender_name, ''), 'DentalCloud'),
    email_message_notifications_enabled = COALESCE(email_message_notifications_enabled, TRUE),
    email_settings_updated_at = COALESCE(email_settings_updated_at, NOW()),
    currency_unit = CASE WHEN currency_unit IN ('USD', 'MMK') THEN currency_unit ELSE 'USD' END,
    receipt_size = CASE WHEN receipt_size IN ('A4', 'THERMAL_55MM') THEN receipt_size ELSE 'A4' END,
    clinical_fee_default_apply_on_registration = COALESCE(clinical_fee_default_apply_on_registration, clinical_fee_enabled, FALSE),
    clinical_fee_new_patient_amount = COALESCE(clinical_fee_new_patient_amount, clinical_fee_amount, 0),
    clinical_fee_returning_patient_amount = COALESCE(clinical_fee_returning_patient_amount, clinical_fee_amount, 0)
WHERE id = 1;

-- Public PNG-only clinic logo bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('app_logos', 'app_logos', TRUE, 2097152, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
SET
  public = TRUE,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png'];

-- Patient files bucket (for document uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('patient_files', 'patient_files', FALSE, 52428800)
ON CONFLICT (id) DO UPDATE
SET
  public = FALSE,
  file_size_limit = 52428800;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read app logos'
  ) THEN
    CREATE POLICY "Public read app logos"
      ON storage.objects
      FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'app_logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public upload app logos'
  ) THEN
    CREATE POLICY "Public upload app logos"
      ON storage.objects
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'app_logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public update app logos'
  ) THEN
    CREATE POLICY "Public update app logos"
      ON storage.objects
      FOR UPDATE
      TO anon, authenticated
      USING (bucket_id = 'app_logos')
      WITH CHECK (bucket_id = 'app_logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public delete app logos'
  ) THEN
    CREATE POLICY "Public delete app logos"
      ON storage.objects
      FOR DELETE
      TO anon, authenticated
      USING (bucket_id = 'app_logos');
  END IF;
END $$;

-- Default admin user bootstrap
-- Change this password immediately after first production login if needed.
INSERT INTO users (username, password, role, location_id, allowed_tabs)
SELECT
  'admin',
  'admin123',
  'admin',
  id,
  '[
    "dashboard",
    "patients",
    "appointments",
    "doctors",
    "finance",
    "treatments",
    "records",
    "inventory",
    "messaging",
    "ai-assistant",
    "users",
    "settings"
  ]'::jsonb
FROM locations
WHERE id = 'fffda6dc-a75d-450c-bc96-94602c5d1194';

-- No demo/sample operational data is inserted in this setup file.

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- IMPORTANT: The application uses custom authentication (plain-text password
-- comparison in the users/patient_auth tables) instead of Supabase Auth.
-- All queries from the frontend use the anon key via supabase-js.
-- Therefore ALL tables need permissive RLS policies for the anon role.
--
-- Without these policies, every single query in the app will fail with 403
-- because Supabase denies all table access by default when RLS is enabled.
-- ============================================================================

-- Helper function to enable RLS and create a permissive policy for each table
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'locations',
    'app_settings',
    'users',
    'patients',
    'patient_types',
    'patient_auth',
    'otp_codes',
    'appointment_types',
    'doctors',
    'doctor_schedules',
    'doctor_treatment_commissions',
    'treatment_types',
    'treatments',
    'payments',
    'appointments',
    'appointment_reschedule_logs',
    'medicines',
    'medicine_sales',
    'loyalty_rules',
    'loyalty_transactions',
    'expenses',
    'conversations',
    'messages',
    'assistant_memory',
    'scheduled_tasks',
    'active_staff_sessions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);

    -- Drop existing policy if any to avoid conflicts on re-run
    EXECUTE format('DROP POLICY IF EXISTS "anon_full_access_%I" ON %I;', tbl, tbl);

    -- Create a permissive policy for anon and authenticated roles
    EXECUTE format('
      CREATE POLICY "anon_full_access_%I" ON %I
        FOR ALL
        TO anon, authenticated
        USING (true)
        WITH CHECK (true);
    ', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================================
-- 7.1 STORAGE BUCKET POLICIES
-- ============================================================================
-- The app_logos bucket is created above in section 6.
-- The patient_files bucket is used by the app for patient document storage.
DO $$
BEGIN
  -- app_logos: public bucket for clinic branding (PNG only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read app logos'
  ) THEN
    CREATE POLICY "Public read app logos"
      ON storage.objects
      FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'app_logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public upload app logos'
  ) THEN
    CREATE POLICY "Public upload app logos"
      ON storage.objects
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'app_logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public update app logos'
  ) THEN
    CREATE POLICY "Public update app logos"
      ON storage.objects
      FOR UPDATE
      TO anon, authenticated
      USING (bucket_id = 'app_logos')
      WITH CHECK (bucket_id = 'app_logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public delete app logos'
  ) THEN
    CREATE POLICY "Public delete app logos"
      ON storage.objects
      FOR DELETE
      TO anon, authenticated
      USING (bucket_id = 'app_logos');
  END IF;

  -- patient_files: private bucket for patient documents
  -- TUS uploads use the anon key with the Bearer token from session (or anon key fallback)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Full access patient files'
  ) THEN
    CREATE POLICY "Full access patient files"
      ON storage.objects
      FOR ALL
      TO anon, authenticated
      USING (bucket_id = 'patient_files')
      WITH CHECK (bucket_id = 'patient_files');
  END IF;
END $$;

-- ============================================================================
-- 9. SUPABASE AUTH (GoTrue) SCHEMA GUARD
-- ============================================================================
-- Self-hosted Supabase's GoTrue container should create the auth schema and
-- auth.users table automatically on startup via its internal migrations. However,
-- if the GoTrue container starts before the database is fully initialized,
-- the auth.users migration may be skipped. This section idempotently creates
-- and repairs the auth.users table to prevent this.
--
-- IMPORTANT FOR SELF-HOSTED SUPABASE:
-- GoTrue connects to Postgres as supabase_auth_admin. If this setup script is
-- executed by another privileged role such as supabase_admin, CREATE TABLE IF
-- NOT EXISTS auth.users can leave auth.users owned by the wrong role and with
-- insufficient grants. That causes auth emails/signups/password resets to fail
-- with errors like:
--   500: Database error finding user: permission denied for table users
-- Therefore, after touching auth.users, this script repairs ownership/grants
-- when the supabase_auth_admin role exists.
-- Ensure the auth schema exists
CREATE SCHEMA IF NOT EXISTS auth;
-- Ensure the auth.users table exists with all columns GoTrue expects
CREATE TABLE IF NOT EXISTS auth.users (
    instance_id UUID,
    id UUID NOT NULL PRIMARY KEY,
    aud VARCHAR(255),
    role VARCHAR(255),
    email VARCHAR(255),
    encrypted_password VARCHAR(255),
    email_confirmed_at TIMESTAMPTZ,
    invited_at TIMESTAMPTZ,
    confirmation_token VARCHAR(255),
    confirmation_sent_at TIMESTAMPTZ,
    recovery_token VARCHAR(255),
    recovery_sent_at TIMESTAMPTZ,
    email_change_token_new VARCHAR(255),
    email_change VARCHAR(255),
    email_change_sent_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    raw_app_meta_data JSONB,
    raw_user_meta_data JSONB,
    is_super_admin BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    phone VARCHAR(255),
    phone_confirmed_at TIMESTAMPTZ,
    phone_change VARCHAR(255),
    phone_change_token VARCHAR(255),
    phone_change_sent_at TIMESTAMPTZ,
    email_change_token_current VARCHAR(255),
    email_change_confirm_status SMALLINT DEFAULT 0,
    banned_until TIMESTAMPTZ,
    reauthentication_token VARCHAR(255),
    reauthentication_sent_at TIMESTAMPTZ,
    is_sso_user BOOLEAN DEFAULT FALSE NOT NULL,
    deleted_at TIMESTAMPTZ,
    is_anonymous BOOLEAN DEFAULT FALSE NOT NULL,
    confirmed_at TIMESTAMPTZ
);
-- Add any missing columns idempotently
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_app_meta_data JSONB;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_change VARCHAR(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone_change VARCHAR(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone_change_token VARCHAR(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone_change_sent_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_change_token_current VARCHAR(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_change_confirm_status SMALLINT;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS reauthentication_token VARCHAR(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS reauthentication_sent_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_sso_user BOOLEAN;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS confirmation_token VARCHAR(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS recovery_token VARCHAR(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS recovery_sent_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_change_token_new VARCHAR(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_change_sent_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone_confirmed_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS instance_id UUID;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS aud VARCHAR(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS role VARCHAR(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS encrypted_password VARCHAR(255);
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_phone ON auth.users(phone);

-- Repair auth schema/table ownership and privileges for self-hosted Supabase.
-- This block is intentionally defensive so local/non-Supabase Postgres setups
-- that do not have the Supabase internal roles can still run the setup script.
DO $$
DECLARE
  auth_object RECORD;
BEGIN
  IF to_regrole('supabase_auth_admin') IS NOT NULL THEN
    ALTER SCHEMA auth OWNER TO supabase_auth_admin;
    GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;

    ALTER TABLE auth.users OWNER TO supabase_auth_admin;
    GRANT ALL PRIVILEGES ON TABLE auth.users TO supabase_auth_admin;

    -- Keep the whole auth schema consistent if other GoTrue-managed tables
    -- already exist. This matches Supabase Auth's expected ownership model and
    -- prevents future permission drift in self-hosted deployments.
    FOR auth_object IN
      SELECT
        n.nspname AS schema_name,
        c.relname AS object_name,
        c.relkind AS object_kind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'auth'
        AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
    LOOP
      IF auth_object.object_kind IN ('r', 'p') THEN
        EXECUTE format(
          'ALTER TABLE %I.%I OWNER TO supabase_auth_admin',
          auth_object.schema_name,
          auth_object.object_name
        );
      ELSIF auth_object.object_kind = 'S' THEN
        EXECUTE format(
          'ALTER SEQUENCE %I.%I OWNER TO supabase_auth_admin',
          auth_object.schema_name,
          auth_object.object_name
        );
      ELSIF auth_object.object_kind = 'v' THEN
        EXECUTE format(
          'ALTER VIEW %I.%I OWNER TO supabase_auth_admin',
          auth_object.schema_name,
          auth_object.object_name
        );
      ELSIF auth_object.object_kind = 'm' THEN
        EXECUTE format(
          'ALTER MATERIALIZED VIEW %I.%I OWNER TO supabase_auth_admin',
          auth_object.schema_name,
          auth_object.object_name
        );
      END IF;
    END LOOP;

    EXECUTE 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin';
    EXECUTE 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin';
  ELSE
    RAISE NOTICE 'Role supabase_auth_admin does not exist; skipped auth schema ownership/grant repair.';
  END IF;
END $$;

-- Verify
SELECT 'auth.users guard complete - table is ready' AS status;

-- ============================================================================
-- 10. VERIFICATION
-- ============================================================================
SELECT '=== DATABASE SETUP COMPLETE ===' as status;

SELECT 'Locations' as table_name, COUNT(*) as count FROM locations
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Patients', COUNT(*) FROM patients
UNION ALL
SELECT 'Patient Auth', COUNT(*) FROM patient_auth
UNION ALL
SELECT 'Doctors', COUNT(*) FROM doctors
UNION ALL
SELECT 'Doctor Schedules', COUNT(*) FROM doctor_schedules
UNION ALL
SELECT 'Treatment Types', COUNT(*) FROM treatment_types
UNION ALL
SELECT 'Medicines', COUNT(*) FROM medicines
UNION ALL
SELECT 'Loyalty Rules', COUNT(*) FROM loyalty_rules
UNION ALL
SELECT 'Conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'Messages', COUNT(*) FROM messages
UNION ALL
SELECT 'Active Staff Sessions', COUNT(*) FROM active_staff_sessions;

SELECT '=== RUN SUCCESSFUL - YOUR DATABASE IS READY ===' as final_message;
