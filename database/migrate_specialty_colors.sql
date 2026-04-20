-- Migration script to update existing specialty category colors
-- This script assigns random colors to existing treatment types that currently have no color differentiation
-- It will update all treatment types to use the new color system

-- Note: Since we're using a hash-based color assignment in the frontend now,
-- the visual colors will be consistent for each category name, but we can
-- still create a migration script for future reference or if we decide to store
-- colors in the database

-- Option 1: Add a color column to the treatment_types table
ALTER TABLE treatment_types ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT NULL;

-- Option 2: Update existing records to have a color value based on category
-- Since we're now using a consistent color generation algorithm in the frontend,
-- we don't need to store colors in the database. The frontend will generate
-- consistent colors based on the category name.

-- However, if you want to store colors in the database, you can run the following:
-- UPDATE treatment_types 
-- SET color = CASE 
--   WHEN category ILIKE '%surgery%' THEN 'red'
--   WHEN category ILIKE '%preventative%' OR category ILIKE '%preventive%' THEN 'green'
--   WHEN category ILIKE '%restorative%' THEN 'blue'
--   WHEN category ILIKE '%orthodontics%' THEN 'yellow'
--   WHEN category ILIKE '%endodontics%' THEN 'purple'
--   ELSE 'gray'  -- Default fallback
-- END
-- WHERE color IS NULL;

-- The migration is primarily handled by the frontend logic now, which means
-- existing records will automatically get consistent colors based on their category names
-- without needing to update the database.

-- You can run this script to add the color column if you decide later to store colors in DB
-- ALTER TABLE treatment_types ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT NULL;

-- Verification query to check current categories
SELECT 
  category,
  COUNT(*) as count
FROM treatment_types 
GROUP BY category 
ORDER BY count DESC;