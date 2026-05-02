-- ============================================================================
-- DENTAL CLOUD - COMPLETE DATABASE INITIALIZATION SCRIPT
-- ============================================================================
-- This script consolidates all database setup for fresh VPS deployment.
-- Run this in your Supabase SQL Editor to set up the database from scratch.
-- 
-- NOTE: Row Level Security (RLS) policies are excluded and will be implemented
-- separately at a later stage.
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
CREATE TABLE patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  age INTEGER,
  address TEXT,
  city VARCHAR(100),
  township VARCHAR(100),
  patient_type VARCHAR(50) DEFAULT 'Walk-in' CHECK (patient_type IN ('Walk-in', 'ONP', 'RNP', 'Hotline', 'Rec-ph call', 'Tiktok', 'Tiktok Hotline')),
  balance DECIMAL(12,2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  medical_history TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patient Authentication
CREATE TABLE patient_auth (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
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
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Doctors
CREATE TABLE doctors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  specialization VARCHAR(255),
  password VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Doctor Schedules
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
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (
    (patient_id IS NOT NULL AND doctor_user_id IS NULL) OR
    (patient_id IS NULL AND doctor_user_id IS NOT NULL)
  )
);

-- Messages (Messaging)
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type VARCHAR(10) CHECK (sender_type IN ('patient', 'admin')) NOT NULL,
  recipient_id UUID NOT NULL,
  recipient_type VARCHAR(10) CHECK (recipient_type IN ('patient', 'admin')) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- ============================================================================
-- 3.1 COMPATIBILITY UPDATES (KEEP THIS FILE SELF-CONTAINED)
-- ============================================================================
-- If this file is edited over time, these idempotent statements help ensure
-- newer app_settings columns exist even if table definitions drift.
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS receipt_email TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS receipt_phone TEXT;
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
CREATE INDEX idx_patients_location ON patients(location_id);
CREATE INDEX idx_patients_email ON patients(email);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_patient_type ON patients(patient_type);
CREATE INDEX idx_patients_city ON patients(city);
CREATE INDEX idx_patients_township ON patients(township);
CREATE INDEX idx_patient_auth_email ON patient_auth(email);
CREATE INDEX idx_patient_auth_phone ON patient_auth(phone);
CREATE INDEX idx_patient_auth_username ON patient_auth(username);
CREATE INDEX idx_patient_auth_patient_id ON patient_auth(patient_id);
CREATE INDEX idx_patient_auth_supabase_user_id ON patient_auth(supabase_user_id);
CREATE INDEX idx_otp_codes_email ON otp_codes(email);
CREATE INDEX idx_otp_codes_expires ON otp_codes(expires_at);
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
INSERT INTO app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Public PNG-only clinic logo bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('app_logos', 'app_logos', TRUE, 2097152, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
SET
  public = TRUE,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png'];

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

-- Sample patient
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
-- 7. VERIFICATION
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
SELECT 'Messages', COUNT(*) FROM messages;

SELECT '=== RUN SUCCESSFUL - YOUR DATABASE IS READY ===' as final_message;
