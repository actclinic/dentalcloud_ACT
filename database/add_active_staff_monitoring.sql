-- Active staff monitoring with event-based login/logout presence updates.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'active_staff_sessions'
      AND column_name = 'last_heartbeat'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'active_staff_sessions'
      AND column_name = 'last_seen'
  ) THEN
    ALTER TABLE active_staff_sessions RENAME COLUMN last_heartbeat TO last_seen;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS active_staff_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username_snapshot VARCHAR(255) NOT NULL,
  role_snapshot VARCHAR(20) NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT active_staff_sessions_role_check CHECK (role_snapshot IN ('admin', 'normal', 'doctor'))
);

ALTER TABLE active_staff_sessions
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE active_staff_sessions
  DROP CONSTRAINT IF EXISTS active_staff_sessions_role_check;

ALTER TABLE active_staff_sessions
  ADD CONSTRAINT active_staff_sessions_role_check
  CHECK (role_snapshot IN ('admin', 'normal', 'doctor'));

CREATE INDEX IF NOT EXISTS idx_active_staff_sessions_user_id
ON active_staff_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_active_staff_sessions_last_seen
ON active_staff_sessions(last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_active_staff_sessions_location_id
ON active_staff_sessions(location_id);

ALTER TABLE active_staff_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_full_access_active_staff_sessions" ON active_staff_sessions;
CREATE POLICY "anon_full_access_active_staff_sessions" ON active_staff_sessions
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION cleanup_stale_active_staff_sessions(
  p_cutoff_minutes INTEGER DEFAULT 60
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM active_staff_sessions
  WHERE last_seen < NOW() - make_interval(mins => GREATEST(p_cutoff_minutes, 1));
END;
$$;

CREATE OR REPLACE FUNCTION upsert_active_staff_session_presence(
  p_session_id TEXT,
  p_user_id UUID,
  p_username TEXT,
  p_role TEXT,
  p_location_id UUID DEFAULT NULL,
  p_login_at TIMESTAMPTZ DEFAULT NOW(),
  p_seen_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM cleanup_stale_active_staff_sessions(60);

  INSERT INTO active_staff_sessions (
    session_id,
    user_id,
    username_snapshot,
    role_snapshot,
    location_id,
    login_at,
    last_seen,
    created_at,
    updated_at
  )
  VALUES (
    p_session_id,
    p_user_id,
    p_username,
    CASE
      WHEN LOWER(COALESCE(p_role, 'normal')) = 'admin' THEN 'admin'
      WHEN LOWER(COALESCE(p_role, 'normal')) = 'doctor' THEN 'doctor'
      ELSE 'normal'
    END,
    p_location_id,
    COALESCE(p_login_at, NOW()),
    COALESCE(p_seen_at, NOW()),
    NOW(),
    NOW()
  )
  ON CONFLICT (session_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    username_snapshot = EXCLUDED.username_snapshot,
    role_snapshot = EXCLUDED.role_snapshot,
    location_id = EXCLUDED.location_id,
    login_at = EXCLUDED.login_at,
    last_seen = EXCLUDED.last_seen,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE VIEW active_staff_presence_view AS
SELECT
  ass.session_id::TEXT AS session_id,
  ass.user_id,
  COALESCE(u.username, ass.username_snapshot)::TEXT AS username,
  ass.role_snapshot::TEXT AS role,
  COALESCE(u.location_id, ass.location_id) AS location_id,
  loc.name::TEXT AS location_name,
  CASE
    WHEN ass.role_snapshot = 'doctor' THEN COALESCE(d.name, u.username, ass.username_snapshot)
    ELSE COALESCE(u.username, ass.username_snapshot)
  END::TEXT AS display_name,
  CASE
    WHEN ass.role_snapshot = 'doctor' THEN d.email
    ELSE NULL
  END::TEXT AS email,
  CASE
    WHEN ass.role_snapshot = 'doctor' THEN d.phone
    ELSE NULL
  END::TEXT AS phone,
  ass.login_at,
  ass.last_seen
FROM active_staff_sessions ass
LEFT JOIN users u
  ON u.id = ass.user_id
LEFT JOIN doctors d
  ON d.id = u.doctor_id
LEFT JOIN locations loc
  ON loc.id = COALESCE(u.location_id, ass.location_id);

CREATE OR REPLACE FUNCTION clear_active_staff_session_presence(
  p_session_id TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM active_staff_sessions
  WHERE session_id = p_session_id;

  PERFORM cleanup_stale_active_staff_sessions(60);
END;
$$;

CREATE OR REPLACE FUNCTION update_and_get_staff_presence(
  p_session_id TEXT,
  p_user_id UUID,
  p_username TEXT,
  p_role TEXT,
  p_location_id UUID DEFAULT NULL,
  p_login_at TIMESTAMPTZ DEFAULT NOW(),
  p_seen_at TIMESTAMPTZ DEFAULT NOW(),
  p_cutoff_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  session_id TEXT,
  user_id UUID,
  username TEXT,
  role TEXT,
  location_id UUID,
  location_name TEXT,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  login_at TIMESTAMPTZ,
  last_seen TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF NULLIF(BTRIM(COALESCE(p_session_id, '')), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTIVE_STAFF_INVALID_SESSION_ID';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTIVE_STAFF_INVALID_USER_ID';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_username, '')), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTIVE_STAFF_INVALID_USERNAME';
  END IF;

  PERFORM upsert_active_staff_session_presence(
    p_session_id,
    p_user_id,
    p_username,
    p_role,
    p_location_id,
    p_login_at,
    p_seen_at
  );

  PERFORM cleanup_stale_active_staff_sessions(GREATEST(COALESCE(p_cutoff_minutes, 60), 1));

  RETURN QUERY
  WITH active_sessions AS (
    SELECT DISTINCT ON (ass.user_id)
      ass.session_id,
      ass.user_id,
      ass.username_snapshot,
      ass.role_snapshot,
      ass.location_id,
      ass.login_at,
      ass.last_seen
    FROM active_staff_sessions ass
    WHERE ass.last_seen >= NOW() - make_interval(mins => GREATEST(COALESCE(p_cutoff_minutes, 60), 1))
    ORDER BY ass.user_id, ass.last_seen DESC
  )
  SELECT
    active_sessions.session_id::TEXT,
    active_sessions.user_id,
    COALESCE(u.username, active_sessions.username_snapshot)::TEXT,
    active_sessions.role_snapshot::TEXT,
    COALESCE(u.location_id, active_sessions.location_id),
    loc.name::TEXT,
    CASE
      WHEN active_sessions.role_snapshot = 'doctor' THEN COALESCE(d.name, u.username, active_sessions.username_snapshot)
      ELSE COALESCE(u.username, active_sessions.username_snapshot)
    END::TEXT,
    CASE
      WHEN active_sessions.role_snapshot = 'doctor' THEN d.email
      ELSE NULL
    END::TEXT,
    CASE
      WHEN active_sessions.role_snapshot = 'doctor' THEN d.phone
      ELSE NULL
    END::TEXT,
    active_sessions.login_at,
    active_sessions.last_seen
  FROM active_sessions
  LEFT JOIN users u ON u.id = active_sessions.user_id
  LEFT JOIN doctors d ON d.id = u.doctor_id
  LEFT JOIN locations loc ON loc.id = COALESCE(u.location_id, active_sessions.location_id)
  ORDER BY active_sessions.last_seen DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_stale_active_staff_sessions(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_active_staff_session_presence(TEXT, UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION clear_active_staff_session_presence(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_and_get_staff_presence(TEXT, UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO anon, authenticated;
GRANT SELECT ON active_staff_presence_view TO anon, authenticated;
