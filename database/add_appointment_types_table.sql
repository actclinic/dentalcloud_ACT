-- Create admin-managed appointment types for the appointment form Type field.
-- Safe for existing databases.

CREATE TABLE IF NOT EXISTS appointment_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO appointment_types (name, sort_order, is_active)
SELECT seeded.name, seeded.sort_order, true
FROM (
  SELECT 'Consult'::VARCHAR(100) AS name, 0 AS sort_order
  UNION ALL
  SELECT 'Check Up'::VARCHAR(100), 1
) AS seeded
ON CONFLICT (name) DO NOTHING;

INSERT INTO appointment_types (name, sort_order, is_active)
SELECT source.name, source.sort_order, true
FROM (
  SELECT DISTINCT TRIM(name)::VARCHAR(100) AS name, ROW_NUMBER() OVER (ORDER BY TRIM(name)) + 9 AS sort_order
  FROM treatment_types
  WHERE TRIM(COALESCE(name, '')) <> ''

  UNION

  SELECT DISTINCT TRIM(type)::VARCHAR(100) AS name, ROW_NUMBER() OVER (ORDER BY TRIM(type)) + 999 AS sort_order
  FROM appointments
  WHERE TRIM(COALESCE(type, '')) <> ''
) AS source
WHERE source.name <> ''
ON CONFLICT (name) DO NOTHING;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, name) - 1 AS new_sort_order
  FROM appointment_types
)
UPDATE appointment_types AS at
SET sort_order = ordered.new_sort_order,
    updated_at = NOW()
FROM ordered
WHERE at.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_appointment_types_sort_order ON appointment_types(sort_order);
CREATE INDEX IF NOT EXISTS idx_appointment_types_active ON appointment_types(is_active);

COMMENT ON TABLE appointment_types IS 'Admin-managed appointment type options used in the appointment form.';
