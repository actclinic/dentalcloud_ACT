-- App Logo Migration
-- Adds PNG-only clinic logo storage for replacing the in-app header/sidebar app name.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS app_logo_url TEXT;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS app_logo_path TEXT;

INSERT INTO app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('app_logos', 'app_logos', TRUE, 2097152, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
SET
  public = TRUE,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png'];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read app logos'
  ) THEN
    CREATE POLICY "Public read app logos"
      ON storage.objects
      FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'app_logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public upload app logos'
  ) THEN
    CREATE POLICY "Public upload app logos"
      ON storage.objects
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'app_logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public update app logos'
  ) THEN
    CREATE POLICY "Public update app logos"
      ON storage.objects
      FOR UPDATE
      TO anon, authenticated
      USING (bucket_id = 'app_logos')
      WITH CHECK (bucket_id = 'app_logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public delete app logos'
  ) THEN
    CREATE POLICY "Public delete app logos"
      ON storage.objects
      FOR DELETE
      TO anon, authenticated
      USING (bucket_id = 'app_logos');
  END IF;
END $$;
