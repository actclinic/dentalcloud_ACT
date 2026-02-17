-- COMPLETE DENTAL CLOUD DATABASE SETUP
-- This creates a complete database with all necessary tables and proper RLS policies
-- Run this in your Supabase SQL Editor to set up your database from scratch

-- 1. Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing tables in correct order (cascade dependencies)
DROP TABLE IF EXISTS medicine_sales CASCADE;
DROP TABLE IF EXISTS medicines CASCADE;
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

-- 3. Create core tables with proper relationships

-- Locations (Multi-tenancy support)
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users (Staff/Admin accounts)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'normal' CHECK (role IN ('admin', 'normal')),
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
  balance DECIMAL(12,2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  medical_history TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patient Authentication
CREATE TABLE patient_auth (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  password VARCHAR(255),
  is_verified BOOLEAN DEFAULT false,
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
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  type VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medicines (Inventory)
CREATE TABLE medicines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50) DEFAULT 'pack',
  price DECIMAL(12,2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
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
  quantity INTEGER NOT NULL CHECK (quantity > 0),
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

-- 4. Create indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_patients_location ON patients(location_id);
CREATE INDEX idx_patient_auth_email ON patient_auth(email);
CREATE INDEX idx_patient_auth_phone ON patient_auth(phone);
CREATE INDEX idx_patient_auth_patient_id ON patient_auth(patient_id);
CREATE INDEX idx_otp_codes_email ON otp_codes(email);
CREATE INDEX idx_otp_codes_expires ON otp_codes(expires_at);
CREATE INDEX idx_doctors_location ON doctors(location_id);
CREATE INDEX idx_treatment_types_location ON treatment_types(location_id);
CREATE INDEX idx_treatments_patient ON treatments(patient_id);
CREATE INDEX idx_treatments_location ON treatments(location_id);
CREATE INDEX idx_treatments_doctor ON treatments(doctor_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_medicines_location ON medicines(location_id);
CREATE INDEX idx_medicines_name ON medicines(name);
CREATE INDEX idx_medicines_category ON medicines(category);
CREATE INDEX idx_medicine_sales_patient ON medicine_sales(patient_id);
CREATE INDEX idx_medicine_sales_medicine ON medicine_sales(medicine_id);
CREATE INDEX idx_medicine_sales_date ON medicine_sales(date);
CREATE INDEX idx_loyalty_transactions_patient ON loyalty_transactions(patient_id);
CREATE INDEX idx_expenses_location ON expenses(location_id);

-- 5. Create update functions for timestamp columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medicines_updated_at 
    BEFORE UPDATE ON medicines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at 
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_auth_updated_at 
    BEFORE UPDATE ON patient_auth
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Enable Row Level Security on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 8. Create comprehensive RLS policies (Permissive for development)
-- SELECT policies
CREATE POLICY "locations_select" ON locations FOR SELECT USING (true);
CREATE POLICY "users_select" ON users FOR SELECT USING (true);
CREATE POLICY "patients_select" ON patients FOR SELECT USING (true);
CREATE POLICY "patient_auth_select" ON patient_auth FOR SELECT USING (true);
CREATE POLICY "otp_codes_select" ON otp_codes FOR SELECT USING (true);
CREATE POLICY "doctors_select" ON doctors FOR SELECT USING (true);
CREATE POLICY "doctor_schedules_select" ON doctor_schedules FOR SELECT USING (true);
CREATE POLICY "treatment_types_select" ON treatment_types FOR SELECT USING (true);
CREATE POLICY "treatments_select" ON treatments FOR SELECT USING (true);
CREATE POLICY "appointments_select" ON appointments FOR SELECT USING (true);
CREATE POLICY "medicines_select" ON medicines FOR SELECT USING (true);
CREATE POLICY "medicine_sales_select" ON medicine_sales FOR SELECT USING (true);
CREATE POLICY "loyalty_rules_select" ON loyalty_rules FOR SELECT USING (true);
CREATE POLICY "loyalty_transactions_select" ON loyalty_transactions FOR SELECT USING (true);
CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (true);

-- INSERT policies
CREATE POLICY "locations_insert" ON locations FOR INSERT WITH CHECK (true);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "patients_insert" ON patients FOR INSERT WITH CHECK (true);
CREATE POLICY "patient_auth_insert" ON patient_auth FOR INSERT WITH CHECK (true);
CREATE POLICY "otp_codes_insert" ON otp_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "doctors_insert" ON doctors FOR INSERT WITH CHECK (true);
CREATE POLICY "doctor_schedules_insert" ON doctor_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "treatment_types_insert" ON treatment_types FOR INSERT WITH CHECK (true);
CREATE POLICY "treatments_insert" ON treatments FOR INSERT WITH CHECK (true);
CREATE POLICY "appointments_insert" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "medicines_insert" ON medicines FOR INSERT WITH CHECK (true);
CREATE POLICY "medicine_sales_insert" ON medicine_sales FOR INSERT WITH CHECK (true);
CREATE POLICY "loyalty_rules_insert" ON loyalty_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "loyalty_transactions_insert" ON loyalty_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (true);

-- UPDATE policies
CREATE POLICY "locations_update" ON locations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "users_update" ON users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "patients_update" ON patients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "patient_auth_update" ON patient_auth FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "otp_codes_update" ON otp_codes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "doctors_update" ON doctors FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "doctor_schedules_update" ON doctor_schedules FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "treatment_types_update" ON treatment_types FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "treatments_update" ON treatments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "appointments_update" ON appointments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "medicines_update" ON medicines FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "medicine_sales_update" ON medicine_sales FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "loyalty_rules_update" ON loyalty_rules FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "loyalty_transactions_update" ON loyalty_transactions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "expenses_update" ON expenses FOR UPDATE USING (true) WITH CHECK (true);

-- DELETE policies
CREATE POLICY "locations_delete" ON locations FOR DELETE USING (true);
CREATE POLICY "users_delete" ON users FOR DELETE USING (true);
CREATE POLICY "patients_delete" ON patients FOR DELETE USING (true);
CREATE POLICY "patient_auth_delete" ON patient_auth FOR DELETE USING (true);
CREATE POLICY "otp_codes_delete" ON otp_codes FOR DELETE USING (true);
CREATE POLICY "doctors_delete" ON doctors FOR DELETE USING (true);
CREATE POLICY "doctor_schedules_delete" ON doctor_schedules FOR DELETE USING (true);
CREATE POLICY "treatment_types_delete" ON treatment_types FOR DELETE USING (true);
CREATE POLICY "treatments_delete" ON treatments FOR DELETE USING (true);
CREATE POLICY "appointments_delete" ON appointments FOR DELETE USING (true);
CREATE POLICY "medicines_delete" ON medicines FOR DELETE USING (true);
CREATE POLICY "medicine_sales_delete" ON medicine_sales FOR DELETE USING (true);
CREATE POLICY "loyalty_rules_delete" ON loyalty_rules FOR DELETE USING (true);
CREATE POLICY "loyalty_transactions_delete" ON loyalty_transactions FOR DELETE USING (true);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (true);

-- 9. Grant permissions to roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 10. Insert initial data
INSERT INTO locations (id, name, address, phone)
VALUES ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Main Clinic', '123 Dental St, Yangon', '09-123456789');

INSERT INTO users (username, password, role, location_id)
SELECT 'admin', 'admin123', 'admin', id FROM locations WHERE id = 'fffda6dc-a75d-450c-bc96-94602c5d1194';

INSERT INTO users (username, password, role, location_id)
SELECT 'staff', 'staff123', 'normal', id FROM locations WHERE id = 'fffda6dc-a75d-450c-bc96-94602c5d1194';

INSERT INTO patients (location_id, name, email, phone)
VALUES ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'John Doe', 'john@example.com', '09-111111111');

INSERT INTO doctors (location_id, name, email, phone, specialization)
VALUES ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Dr. Smith', 'drsmith@clinic.com', '09-222222222', 'General Dentistry');

INSERT INTO treatment_types (location_id, name, cost, category)
VALUES 
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Scaling', 30000, 'Preventative'),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Filling', 50000, 'Restorative'),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Extraction', 40000, 'Surgery');

INSERT INTO medicines (location_id, name, description, unit, price, stock, min_stock, category)
VALUES 
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Paracetamol', 'Pain reliever', 'tablet', 500, 100, 20, 'Pain Management'),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Amoxicillin', 'Antibiotic', 'capsule', 1000, 50, 10, 'Antibiotics');

INSERT INTO loyalty_rules (location_id, name, event_type, points_per_unit, min_amount, active)
VALUES 
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Treatment Points', 'TREATMENT', 0.001, 10000, true),
  ('fffda6dc-a75d-450c-bc96-94602c5d1194', 'Default Redemption', 'REDEEM', 1, 500, true);

-- 11. Verify setup
SELECT '=== DATABASE SETUP COMPLETE ===' as status;

SELECT 'Locations' as table_name, COUNT(*) as count FROM locations
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Patients', COUNT(*) FROM patients
UNION ALL
SELECT 'Doctors', COUNT(*) FROM doctors
UNION ALL
SELECT 'Treatment Types', COUNT(*) FROM treatment_types
UNION ALL
SELECT 'Medicines', COUNT(*) FROM medicines;

SELECT '=== RUN SUCCESSFUL - YOUR DATABASE IS READY ===' as final_message;