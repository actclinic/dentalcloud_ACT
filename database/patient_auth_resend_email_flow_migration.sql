-- Patient auth email flow migration for Resend-based signup OTP and password reset.
--
-- Context for backend team:
-- The frontend no longer uses Supabase Auth mail templates for patient signup
-- OTP verification or forgot-password recovery. It now uses the existing Resend-backed
-- Edge Function (`send-manager-email`) and these application tables:
--   - patient_auth: stores patient portal credentials and verification state
--   - otp_codes: stores one-time 6 digit signup OTP/reset codes
--
-- Run this script once on production Supabase/Postgres. It is intentionally
-- idempotent and safe to re-run.

BEGIN;

-- 1) Ensure patient_auth supports pending/unverified accounts.
ALTER TABLE IF EXISTS public.patient_auth
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS public.patient_auth
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Existing patient_auth rows are active legacy accounts. Mark NULL verification
-- values as verified so current patients are not locked out.
UPDATE public.patient_auth
SET is_verified = true
WHERE is_verified IS NULL;

-- 2) Ensure otp_codes supports reusable verification storage.
ALTER TABLE IF EXISTS public.otp_codes
  ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS public.otp_codes
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE public.otp_codes
SET used = false
WHERE used IS NULL;

-- The current frontend stores 6 digit codes. Keep the code column at least 6 chars.
-- This block only widens too-short VARCHAR columns; it will not shrink wider columns.
DO $$
DECLARE
  code_length INTEGER;
BEGIN
  SELECT character_maximum_length
  INTO code_length
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'otp_codes'
    AND column_name = 'code';

  IF code_length IS NOT NULL AND code_length < 6 THEN
    ALTER TABLE public.otp_codes ALTER COLUMN code TYPE VARCHAR(6);
  END IF;
END $$;

-- 3) Helpful indexes for OTP/reset lookups.
CREATE INDEX IF NOT EXISTS idx_patient_auth_email_verified
  ON public.patient_auth (email, is_verified);

CREATE INDEX IF NOT EXISTS idx_patient_auth_username_verified
  ON public.patient_auth (username, is_verified);

CREATE INDEX IF NOT EXISTS idx_otp_codes_email_code_used_expires
  ON public.otp_codes (email, code, used, expires_at);

COMMIT;

-- Backend deployment checklist:
-- 1. Run this SQL against production.
-- 2. Confirm the Supabase Edge Function `send-manager-email` is deployed and has
--    Resend secrets configured, for example RESEND_API_KEY and default sender vars.
-- 3. Confirm `send-manager-email` accepts anon/client calls needed before login,
--    or explicitly allows the patient signup/reset request shape safely.
-- 4. Supabase Auth SMTP/templates can remain configured, but patient signup/reset
--    no longer depend on GOTRUE_MAILER_TEMPLATES_CONFIRMATION or RECOVERY.