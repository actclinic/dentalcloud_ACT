-- ============================================================================
-- FULL MATERIAL COST FEATURE ROLLBACK
-- ============================================================================
-- Purpose:
--   Remove all database objects introduced for the Material Costs feature while
--   leaving existing DentalCloud operational data untouched.
--
-- Safe scope:
--   - Drops only Material Cost feature tables, RPCs/functions, and the Material
--     Cost trigger installed on public.payments.
--   - Does NOT delete or update patients, treatments, payments, users,
--     locations, appointments, expenses, or other application tables.
--   - Does NOT drop pgcrypto, because other features may use it.
--
-- Data impact:
--   - Deletes only rows stored in Material Cost feature tables because those
--     tables are removed:
--       public.material_cost_allocations
--       public.material_cost_entries
--       public.material_cost_sessions
--       public.material_cost_authorizers
--   - Original payment/treatment records and receipt data remain unchanged.
--
-- Usage:
--   1. Back up production before running any destructive SQL.
--   2. Run this file once in Supabase SQL Editor.
--   3. Confirm the final SELECT returns no material_cost objects.
-- ============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Remove the only Material Cost trigger installed on a non-Material-Cost table.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_payment_below_material_allocations
ON public.payments;

-- -----------------------------------------------------------------------------
-- 2. Remove Material Cost RPCs/helper functions.
--
-- CASCADE is intentionally limited to functions whose dependents are also part
-- of this feature, so the script remains idempotent across partially applied
-- Material Cost migrations/patches.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_material_cost(TEXT, UUID, NUMERIC, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.list_material_cost_entries(TEXT, UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.authorize_material_cost_access_for_user(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.authorize_material_cost_access(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.set_material_cost_financial_pin(UUID, TEXT, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.material_cost_authorized_user(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.prevent_payment_below_material_allocations() CASCADE;

-- -----------------------------------------------------------------------------
-- 3. Remove Material Cost tables in dependency-safe order.
--
-- No CASCADE is needed here for the normal schema because dependencies point
-- from these feature tables to existing app tables, not the reverse. The trigger
-- and functions that referenced these tables were removed above.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.material_cost_allocations;
DROP TABLE IF EXISTS public.material_cost_entries;
DROP TABLE IF EXISTS public.material_cost_sessions;
DROP TABLE IF EXISTS public.material_cost_authorizers;

-- -----------------------------------------------------------------------------
-- 4. Ask PostgREST/Supabase to refresh its schema cache so removed RPCs stop
--    appearing/being cached by the REST API.
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- -----------------------------------------------------------------------------
-- Verification: this should return zero rows after rollback.
-- -----------------------------------------------------------------------------
SELECT n.nspname AS schema_name,
       c.relkind AS object_type,
       c.relname AS object_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'material_cost%'

UNION ALL

SELECT n.nspname AS schema_name,
       'f' AS object_type,
       p.proname AS object_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE '%material_cost%'
    OR p.proname = 'prevent_payment_below_material_allocations'
  )

UNION ALL

SELECT event_object_schema AS schema_name,
       't' AS object_type,
       trigger_name AS object_name
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND trigger_name = 'trg_prevent_payment_below_material_allocations'

ORDER BY schema_name, object_type, object_name;