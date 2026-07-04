-- ============================================================================
-- ADD 80MM THERMAL RECEIPT FORMAT
-- Allows app_settings.receipt_size to store THERMAL_80MM for 80mm thermal
-- receipt printers. Safe to run multiple times.
-- ============================================================================

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS receipt_size VARCHAR(20) NOT NULL DEFAULT 'A4';

UPDATE app_settings
SET receipt_size = CASE
  WHEN receipt_size IN ('A4', 'THERMAL_55MM', 'THERMAL_80MM') THEN receipt_size
  ELSE 'A4'
END;

ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_receipt_size_check;

ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_receipt_size_check
  CHECK (receipt_size IN ('A4', 'THERMAL_55MM', 'THERMAL_80MM'));