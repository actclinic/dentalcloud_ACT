-- Messaging tables for Dental Cloud with automatic cleanup

-- Conversations table - tracks patient-admin conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(id) ON DELETE CASCADE,
    last_message TEXT,
    last_message_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure each patient-admin pair has only one conversation
    UNIQUE(patient_id, admin_id)
);

-- Messages table - stores individual messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    sender_type VARCHAR(10) CHECK (sender_type IN ('patient', 'admin')) NOT NULL,
    recipient_id UUID NOT NULL,
    recipient_type VARCHAR(10) CHECK (recipient_type IN ('patient', 'admin')) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_patient_id ON conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_conversations_admin_id ON conversations(admin_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, recipient_type, read);

-- Function to update conversation timestamp
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation timestamp when new message is added
CREATE TRIGGER update_conversation_on_new_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Function to clean up old messages (older than 2 months)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS void AS $$
BEGIN
    -- Delete messages older than 2 months
    DELETE FROM messages 
    WHERE timestamp < NOW() - INTERVAL '2 months';
    
    -- Clean up conversations that have no messages and are older than 2 months
    DELETE FROM conversations 
    WHERE id NOT IN (
        SELECT DISTINCT conversation_id 
        FROM messages
    ) 
    AND created_at < NOW() - INTERVAL '2 months';
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Patients can view their conversations" 
    ON conversations FOR SELECT 
    USING (patient_id = (SELECT id FROM patients WHERE id = auth.uid()));

CREATE POLICY "Admins can view conversations they're part of" 
    ON conversations FOR SELECT 
    USING (admin_id = (SELECT id FROM users WHERE id = auth.uid()));

CREATE POLICY "Patients can create conversations" 
    ON conversations FOR INSERT 
    WITH CHECK (patient_id = (SELECT id FROM patients WHERE id = auth.uid()));

CREATE POLICY "Admins can create conversations" 
    ON conversations FOR INSERT 
    WITH CHECK (admin_id = (SELECT id FROM users WHERE id = auth.uid()));

-- Messages policies
CREATE POLICY "Users can view messages in their conversations" 
    ON messages FOR SELECT 
    USING (
        conversation_id IN (
            SELECT id FROM conversations 
            WHERE patient_id = (SELECT id FROM patients WHERE id = auth.uid())
            OR admin_id = (SELECT id FROM users WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can send messages in their conversations" 
    ON messages FOR INSERT 
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations 
            WHERE patient_id = (SELECT id FROM patients WHERE id = auth.uid())
            OR admin_id = (SELECT id FROM users WHERE id = auth.uid())
        )
    );