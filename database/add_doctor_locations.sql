-- Allow doctors to work in multiple branches while keeping doctors.location_id as the primary/default branch.
CREATE TABLE IF NOT EXISTS doctor_locations (
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (doctor_id, location_id)
);

INSERT INTO doctor_locations (doctor_id, location_id)
SELECT id, location_id
FROM doctors
WHERE location_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_doctor_locations_location_id ON doctor_locations(location_id);

ALTER TABLE doctor_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on doctor_locations" ON doctor_locations;
CREATE POLICY "Allow all operations on doctor_locations" ON doctor_locations
  FOR ALL USING (true) WITH CHECK (true);