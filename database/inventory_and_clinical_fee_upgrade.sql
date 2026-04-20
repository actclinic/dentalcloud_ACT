-- ============================================================================
-- MIGRATION: Flexible Inventory + Registration Clinical Fee
-- ============================================================================
-- Purpose:
-- 1) Allow inventory to include non-medicine items (retail/supplies).
-- 2) Support decimal stock and sale quantity (e.g., 1.5 card).
-- 3) Add global clinical fee settings for new patient registration.
--
-- Safe to run multiple times.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. app_settings: clinical fee controls
-- ----------------------------------------------------------------------------
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS clinical_fee_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS clinical_fee_amount DECIMAL(12,2) DEFAULT 0;

ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_clinical_fee_amount_check;

ALTER TABLE app_settings
  ADD CONSTRAINT app_settings_clinical_fee_amount_check
  CHECK (clinical_fee_amount >= 0);

UPDATE app_settings
SET clinical_fee_enabled = COALESCE(clinical_fee_enabled, FALSE),
    clinical_fee_amount = COALESCE(clinical_fee_amount, 0)
WHERE id = 1;

INSERT INTO app_settings (id, clinical_fee_enabled, clinical_fee_amount)
VALUES (1, FALSE, 0)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. medicines: item type + decimal inventory + dispense step
-- ----------------------------------------------------------------------------
ALTER TABLE medicines
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'Medicine',
  ADD COLUMN IF NOT EXISTS quantity_step DECIMAL(12,2) DEFAULT 1;

ALTER TABLE medicines
  ALTER COLUMN stock TYPE DECIMAL(12,2) USING stock::DECIMAL(12,2),
  ALTER COLUMN min_stock TYPE DECIMAL(12,2) USING min_stock::DECIMAL(12,2),
  ALTER COLUMN stock SET DEFAULT 0,
  ALTER COLUMN min_stock SET DEFAULT 0,
  ALTER COLUMN quantity_step SET DEFAULT 1;

ALTER TABLE medicines
  DROP CONSTRAINT IF EXISTS medicines_item_type_check;

ALTER TABLE medicines
  ADD CONSTRAINT medicines_item_type_check
  CHECK (item_type IN ('Medicine', 'Retail', 'Supply', 'Other'));

ALTER TABLE medicines
  DROP CONSTRAINT IF EXISTS medicines_quantity_step_check;

ALTER TABLE medicines
  ADD CONSTRAINT medicines_quantity_step_check
  CHECK (quantity_step > 0);

UPDATE medicines
SET item_type = CASE
      WHEN item_type IS NULL OR btrim(item_type) = '' THEN
        CASE
          WHEN lower(COALESCE(category, '')) LIKE '%oral%'
            OR lower(COALESCE(category, '')) LIKE '%retail%'
            OR lower(COALESCE(name, '')) LIKE '%toothbrush%'
            OR lower(COALESCE(name, '')) LIKE '%toothpaste%'
            OR lower(COALESCE(name, '')) LIKE '%mouthwash%'
            THEN 'Retail'
          ELSE 'Medicine'
        END
      ELSE item_type
    END,
    quantity_step = CASE WHEN quantity_step IS NULL OR quantity_step <= 0 THEN 1 ELSE quantity_step END;

CREATE INDEX IF NOT EXISTS idx_medicines_item_type ON medicines(item_type);

-- ----------------------------------------------------------------------------
-- 3. medicine_sales: decimal quantity
-- ----------------------------------------------------------------------------
ALTER TABLE medicine_sales
  ALTER COLUMN quantity TYPE DECIMAL(12,2) USING quantity::DECIMAL(12,2);

ALTER TABLE medicine_sales
  DROP CONSTRAINT IF EXISTS medicine_sales_quantity_check;

ALTER TABLE medicine_sales
  ADD CONSTRAINT medicine_sales_quantity_check
  CHECK (quantity > 0);

COMMIT;

-- Verification
SELECT
  'migration_ok' AS status,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'clinical_fee_enabled'
  ) AS has_clinical_fee_enabled,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'medicines' AND column_name = 'item_type'
  ) AS has_item_type,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'medicines' AND column_name = 'quantity_step'
  ) AS has_quantity_step,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'medicine_sales' AND column_name = 'quantity' AND data_type = 'numeric'
  ) AS sales_quantity_is_numeric;
