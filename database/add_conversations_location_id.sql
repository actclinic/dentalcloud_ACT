-- Add location_id to conversations table for branch scoping
-- This ensures conversations are filtered by clinic location when switching branches

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_location_id ON conversations(location_id);

-- Also add location_id to messages for direct branch filtering
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_location_id ON messages(location_id);
