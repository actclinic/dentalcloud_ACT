-- ============================================================================
-- FACTORY RESET DATABASE
-- Purpose:
-- Completely remove DentalCloud app data so the database can be rebuilt as if
-- it were new.
--
-- WARNING:
-- - This is destructive.
-- - It does NOT directly delete Supabase Storage objects, because Supabase
--   blocks direct SQL deletion from storage.objects in SQL Editor.
-- - Clear app_logos and patient_files from the Storage UI or Storage API
--   separately if you need storage contents wiped too.
-- - It drops app tables, app sequences, and app RPC functions.
-- - It does NOT drop Supabase system schemas such as auth/storage/realtime.
--
-- After running this file, run:
--   database/complete_database_setup.sql
-- to recreate the application schema from scratch.
-- ============================================================================

BEGIN;

-- NOTE:
-- Do not delete from storage.objects here.
-- Supabase raises:
--   Direct deletion from storage tables is not allowed. Use the Storage API.
--
-- We intentionally leave storage buckets and objects alone in this SQL reset.
-- The production setup script already uses UPSERT/ON CONFLICT logic for the
-- app buckets, so leaving bucket metadata in place will not break rebuilds.

-- Drop app-specific RPC functions first to avoid signature drift.
DROP FUNCTION IF EXISTS public.process_patient_payment(UUID, DECIMAL, TEXT, UUID[], DATE, JSONB, UUID, TEXT);
DROP FUNCTION IF EXISTS public.process_patient_payment(UUID, NUMERIC, TEXT, UUID[], DATE, JSONB, NUMERIC, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.complete_appointment_with_clinical_fee(UUID, BOOLEAN);

-- Drop app tables in dependency-safe order.
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.medicine_sales CASCADE;
DROP TABLE IF EXISTS public.medicines CASCADE;
DROP TABLE IF EXISTS public.scheduled_tasks CASCADE;
DROP TABLE IF EXISTS public.assistant_memory CASCADE;
DROP TABLE IF EXISTS public.recalls CASCADE;
DROP TABLE IF EXISTS public.otp_codes CASCADE;
DROP TABLE IF EXISTS public.patient_auth CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.treatments CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.doctor_treatment_commissions CASCADE;
DROP TABLE IF EXISTS public.doctor_schedules CASCADE;
DROP TABLE IF EXISTS public.doctors CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.patient_types CASCADE;
DROP TABLE IF EXISTS public.treatment_types CASCADE;
DROP TABLE IF EXISTS public.appointment_types CASCADE;
DROP TABLE IF EXISTS public.loyalty_transactions CASCADE;
DROP TABLE IF EXISTS public.loyalty_rules CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
DROP TABLE IF EXISTS public.app_settings CASCADE;

-- Drop app sequences so IDs/receipt numbers start fresh again.
DROP SEQUENCE IF EXISTS public.patient_id_seq CASCADE;
DROP SEQUENCE IF EXISTS public.payment_receipt_seq CASCADE;

-- Clear PostgREST schema cache after destructive reset.
NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT 'factory_reset_complete' AS status;
