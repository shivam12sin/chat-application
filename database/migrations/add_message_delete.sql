-- Message Delete Feature Migration
-- Adds tables for "Delete for Me" and "Delete for Everyone" with undo

-- Table for "Delete for Me" - tracks which messages are hidden for which users
CREATE TABLE IF NOT EXISTS message_hidden_for (
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    hidden_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id)
);

-- Index for fast lookups when fetching messages
CREATE INDEX IF NOT EXISTS idx_message_hidden_user ON message_hidden_for(user_id);

-- Table for "Delete for Everyone" - 7-second undo buffer before hard delete
CREATE TABLE IF NOT EXISTS pending_deletes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    requester_id INTEGER NOT NULL REFERENCES users(id),
    room_id INTEGER NOT NULL,
    message_data JSONB NOT NULL,  -- Full message backup for undo
    delete_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- NOW() + 7 seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for finding expired pending deletes
CREATE INDEX IF NOT EXISTS idx_pending_deletes_delete_at ON pending_deletes(delete_at);
