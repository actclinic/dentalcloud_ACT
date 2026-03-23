-- Add flexible tab permissions for staff accounts.
-- Managers/admins keep full access, while normal accounts can receive a custom tab list.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS allowed_tabs JSONB;

UPDATE users
SET allowed_tabs = CASE
  WHEN role = 'admin' THEN '[
    "dashboard",
    "patients",
    "appointments",
    "doctors",
    "finance",
    "treatments",
    "records",
    "inventory",
    "messaging",
    "recalls",
    "ai-assistant",
    "users",
    "settings"
  ]'::jsonb
  ELSE '[
    "dashboard",
    "patients",
    "appointments",
    "doctors",
    "finance",
    "ai-assistant"
  ]'::jsonb
END
WHERE allowed_tabs IS NULL
   OR jsonb_typeof(allowed_tabs) <> 'array';

ALTER TABLE users
ALTER COLUMN allowed_tabs
SET DEFAULT '["dashboard","patients","appointments","doctors","finance","ai-assistant"]'::jsonb;

ALTER TABLE users
ALTER COLUMN allowed_tabs
SET NOT NULL;
