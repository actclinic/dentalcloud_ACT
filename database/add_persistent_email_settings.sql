-- ============================================================================
-- PERSISTENT EMAIL DELIVERY SETTINGS MIGRATION
-- ============================================================================
-- Run this once in the Supabase SQL Editor for existing deployments.
-- It stores Settings > Email Delivery values in the shared app_settings row
-- so all devices use the same configuration.

CREATE TABLE IF NOT EXISTS app_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_delivery_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_sender_name TEXT DEFAULT 'DentalCloud';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_sender_email TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_message_notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS email_settings_updated_at TIMESTAMP WITH TIME ZONE;

INSERT INTO app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

UPDATE app_settings
SET
  email_delivery_enabled = COALESCE(email_delivery_enabled, FALSE),
  email_sender_name = COALESCE(NULLIF(email_sender_name, ''), 'DentalCloud'),
  email_message_notifications_enabled = COALESCE(email_message_notifications_enabled, TRUE),
  email_settings_updated_at = COALESCE(email_settings_updated_at, NOW())
WHERE id = 1;

SELECT
  id,
  email_delivery_enabled,
  email_sender_name,
  email_sender_email,
  email_message_notifications_enabled,
  email_settings_updated_at
FROM app_settings
WHERE id = 1;