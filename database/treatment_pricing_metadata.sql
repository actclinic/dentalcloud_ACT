-- Store the standard treatment charge and item-level discount/FOC information.
-- Run this before relying on persisted receipt adjustment details across reloads.

ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS standard_cost DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_note VARCHAR(20);

UPDATE treatments
SET standard_cost = COALESCE(standard_cost, cost),
    discount_amount = COALESCE(discount_amount, 0)
WHERE standard_cost IS NULL OR discount_amount IS NULL;

ALTER TABLE treatments
  DROP CONSTRAINT IF EXISTS treatments_standard_cost_check,
  DROP CONSTRAINT IF EXISTS treatments_discount_amount_check,
  DROP CONSTRAINT IF EXISTS treatments_pricing_note_check;

ALTER TABLE treatments
  ADD CONSTRAINT treatments_standard_cost_check CHECK (standard_cost IS NULL OR standard_cost >= 0),
  ADD CONSTRAINT treatments_discount_amount_check CHECK (discount_amount >= 0),
  ADD CONSTRAINT treatments_pricing_note_check CHECK (pricing_note IS NULL OR pricing_note IN ('FOC', 'DISCOUNT'));
