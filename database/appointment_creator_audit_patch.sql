-- Track which staff user created each appointment for audit and marketing reporting.
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by_user_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_appointments_created_by_user_id
ON appointments(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_appointments_created_at
ON appointments(created_at);
