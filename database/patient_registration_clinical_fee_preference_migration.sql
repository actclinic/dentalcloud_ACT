-- ============================================================================
-- MIGRATION: Persist patient registration clinical fee apply/skip preference
-- ============================================================================
-- Purpose:
-- Keep the Patient Registration "Clinical Fee on Registration" Apply/Skip
-- choice persistent across reloads, devices, and entry points.
--
-- Safe to run multiple times.
-- ============================================================================

BEGIN;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS clinical_fee_default_apply_on_registration BOOLEAN DEFAULT FALSE;

INSERT INTO app_settings (id, clinical_fee_default_apply_on_registration)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

UPDATE app_settings
SET clinical_fee_default_apply_on_registration = COALESCE(
  clinical_fee_default_apply_on_registration,
  clinical_fee_enabled,
  FALSE
)
WHERE id = 1;

COMMIT;

SELECT
  'migration_ok' AS status,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'app_settings'
      AND column_name = 'clinical_fee_default_apply_on_registration'
  ) AS has_clinical_fee_default_apply_on_registration;
