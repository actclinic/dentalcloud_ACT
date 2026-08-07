-- ============================================================================
-- Inventory Discount/FOC Feature — Database Migration
-- ============================================================================
-- Adds discount fields to medicine_sales to support per-item discounts and
-- Free of Charge (FOC) dispensing, matching the existing treatment discount
-- pattern.
-- ============================================================================

-- 1. Add discount columns to medicine_sales
ALTER TABLE medicine_sales
  ADD COLUMN IF NOT EXISTS standard_total_price DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_note VARCHAR(20);

-- 2. Backfill existing rows: assume no discount was applied by default
--    standard_total_price = total_price, discount_amount = 0, pricing_note = NULL
UPDATE medicine_sales
   SET standard_total_price = total_price,
       discount_amount = 0,
       pricing_note = NULL
 WHERE standard_total_price IS NULL;

-- 3. Add CHECK constraints for data integrity
--    discount_amount must be non-negative
ALTER TABLE medicine_sales
  ADD CONSTRAINT medicine_sales_discount_non_negative
    CHECK (discount_amount IS NULL OR discount_amount >= 0);

--    pricing_note must be one of the recognised values when present
ALTER TABLE medicine_sales
  ADD CONSTRAINT medicine_sales_pricing_note_values
    CHECK (pricing_note IS NULL OR pricing_note IN ('FOC', 'DISCOUNT'));

-- 4. (Optional) Create an index for reporting queries that filter by discount
CREATE INDEX IF NOT EXISTS idx_medicine_sales_pricing_note
    ON medicine_sales (pricing_note)
 WHERE pricing_note IS NOT NULL;
