-- ============================================================================
-- SHARED RECEIPT PREFERENCES MIGRATION
-- Stores receipt header title, currency, and output format centrally so every
-- clinic device uses the same settings.
-- ============================================================================

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS receipt_header_title TEXT;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS currency_unit VARCHAR(3) NOT NULL DEFAULT 'USD';

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS receipt_size VARCHAR(20) NOT NULL DEFAULT 'A4';

INSERT INTO app_settings (id, currency_unit, receipt_size)
VALUES (1, 'USD', 'A4')
ON CONFLICT (id) DO NOTHING;

UPDATE app_settings
SET
  currency_unit = CASE WHEN currency_unit IN ('USD', 'MMK') THEN currency_unit ELSE 'USD' END,
  receipt_size = CASE WHEN receipt_size IN ('A4', 'THERMAL_55MM') THEN receipt_size ELSE 'A4' END,
  updated_at = NOW()
WHERE id = 1;

ALTER TABLE app_settings
  ALTER COLUMN currency_unit SET DEFAULT 'USD',
  ALTER COLUMN currency_unit SET NOT NULL,
  ALTER COLUMN receipt_size SET DEFAULT 'A4',
  ALTER COLUMN receipt_size SET NOT NULL;

ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_currency_unit_check;

ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_currency_unit_check
  CHECK (currency_unit IN ('USD', 'MMK'));

ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_receipt_size_check;

ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_receipt_size_check
  CHECK (receipt_size IN ('A4', 'THERMAL_55MM'));

SELECT
  id,
  receipt_header_title,
  currency_unit,
  receipt_size,
  updated_at
FROM app_settings
WHERE id = 1;
