-- Simplified Patient Authentication Tables (No RLS issues)
-- Run this SQL in your Supabase SQL Editor

-- Patient authentication table
CREATE TABLE IF NOT EXISTS patient_auth (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  password VARCHAR(255),
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OTP codes table for email verification
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patient_auth_email ON patient_auth(email);
CREATE INDEX IF NOT EXISTS idx_patient_auth_phone ON patient_auth(phone);
CREATE INDEX IF NOT EXISTS idx_patient_auth_patient_id ON patient_auth(patient_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expires_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_patient_auth_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at for patient_auth
CREATE TRIGGER update_patient_auth_updated_at 
    BEFORE UPDATE ON patient_auth
    FOR EACH ROW EXECUTE FUNCTION update_patient_auth_updated_at();

-- For development: Allow all operations (no RLS)
-- You can add proper RLS policies later when you have authentication set up

-- Sample data for testing (optional)
-- INSERT INTO patient_auth (patient_id, email, phone, is_verified) 
-- SELECT id, email, phone, true 
-- FROM patients 
-- LIMIT 5;