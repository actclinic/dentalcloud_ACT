-- Run once in Supabase SQL Editor
-- Adds global hover theme setting used by admin/doctor/patient dashboards.

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS hover_theme text NOT NULL DEFAULT 'blue';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_hover_theme_check'
  ) THEN
    ALTER TABLE app_settings
    ADD CONSTRAINT app_settings_hover_theme_check
    CHECK (hover_theme IN ('blue', 'green', 'yellow', 'brown', 'dark'));
  END IF;
END $$;

