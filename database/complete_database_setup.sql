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
  
  -- Custom app name (defaults to "DentalCloud Pro")
  app_name VARCHAR(255) DEFAULT 'DentalCloud Pro',
  app_logo_url TEXT,
  app_logo_path TEXT,
  receipt_email TEXT,
  receipt_phone TEXT,

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
ADD COLUMN doctor_id UUID UNIQUE REFERENCES doctors(id) ON DELETE SET NULL;

-- Treatment Types (Services/Procedures)
CREATE TABLE treatment_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(255) NOT NULL,
  cost DECIMAL(12,2) NOT NULL,
  category VARCHAR(50),
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
  doctor_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES users(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (
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

-- Recalls
CREATE TABLE recalls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  reminder_days_before INTEGER DEFAULT 7,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SCHEDULED', 'COMPLETED', 'OVERDUE', 'CANCELLED')),
  notes TEXT,
  last_reminded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recalls_location ON recalls(location_id);
CREATE INDEX IF NOT EXISTS idx_recalls_patient ON recalls(patient_id);
CREATE INDEX IF NOT EXISTS idx_recalls_status ON recalls(status);
CREATE INDEX IF NOT EXISTS idx_recalls_due_date ON recalls(due_date);

-- ============================================================================
-- 3.1 COMPATIBILITY UPDATES (KEEP THIS FILE SELF-CONTAINED)
-- ============================================================================
-- If this file is edited over time, these idempotent statements help ensure
-- newer app_settings columns exist even if table definitions drift.
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS receipt_email TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS receipt_phone TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_delivery_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_sender_name TEXT DEFAULT 'DentalCloud';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_sender_email TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_message_notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_settings_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS app_logo_url TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS app_logo_path TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS hover_theme TEXT NOT NULL DEFAULT 'blue';

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

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_location ON users(location_id);
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
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_location ON appointments(location_id);
CREATE INDEX idx_appointments_created_by_user_id ON appointments(created_by_user_id);
CREATE INDEX idx_appointments_created_at ON appointments(created_at);
CREATE INDEX idx_appointments_guest_phone ON appointments(guest_phone);
CREATE INDEX idx_appointments_guest_source ON appointments(guest_source);
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

-- Generic function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

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
    email_settings_updated_at = COALESCE(email_settings_updated_at, NOW())
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

-- Default admin user
INSERT INTO users (username, password, role, location_id)
SELECT 'admin', 'admin123', 'admin', id FROM locations WHERE id = 'fffda6dc-a75d-450c-bc96-94602c5d1194';

-- Default staff user
INSERT INTO users (username, password, role, location_id)
SELECT 'staff', 'staff123', 'normal', id FROM locations WHERE id = 'fffda6dc-a75d-450c-bc96-94602c5d1194';

-- Sample patient (patient_unique_id auto-generated by trigger)
INSERT INTO patients (location_id, name, email, phone)
VALUES ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'John Doe', 'john@example.com', '09-111111111');

-- Sample doctor
INSERT INTO doctors (location_id, name, email, phone, specialization)
VALUES ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Dr. Smith', 'drsmith@clinic.com', '09-222222222', 'General Dentistry');

-- Sample treatment types
INSERT INTO treatment_types (location_id, name, cost, category)
VALUES 
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Scaling', 30000, 'Preventative'),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Filling', 50000, 'Restorative'),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Extraction', 40000, 'Surgery'),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Root Canal', 150000, 'Endodontics'),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Crown', 200000, 'Prosthodontics');

-- Sample medicines
INSERT INTO medicines (location_id, name, description, unit, price, stock, min_stock, category)
VALUES 
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Paracetamol', 'Pain reliever for mild to moderate pain', 'tablet', 500, 100, 20, 'Pain Management'),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Amoxicillin', 'Antibiotic for bacterial infections', 'capsule', 1000, 50, 10, 'Antibiotics'),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Ibuprofen', 'Anti-inflammatory pain reliever', 'tablet', 800, 75, 15, 'Pain Management'),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Chlorhexidine', 'Antiseptic mouthwash', 'bottle', 5000, 30, 5, 'Antiseptics');

-- Sample loyalty rules
INSERT INTO loyalty_rules (location_id, name, event_type, points_per_unit, min_amount, active)
VALUES 
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Treatment Points', 'TREATMENT', 0.001, 10000, true),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Purchase Points', 'PURCHASE', 0.002, 5000, true),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Default Redemption', 'REDEEM', 1, 500, true);

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
    'treatment_types',
    'treatments',
    'appointments',
    'medicines',
    'medicine_sales',
    'loyalty_rules',
    'loyalty_transactions',
    'expenses',
    'conversations',
    'messages',
    'assistant_memory',
    'scheduled_tasks',
    'recalls'
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
SELECT 'Recalls', COUNT(*) FROM recalls
UNION ALL
SELECT 'Conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'Messages', COUNT(*) FROM messages;

SELECT '=== RUN SUCCESSFUL - YOUR DATABASE IS READY ===' as final_message;
