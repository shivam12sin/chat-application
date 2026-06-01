CREATE TYPE scheduled_message_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled');

CREATE TABLE scheduled_messages (
    id UUID PRIMARY KEY,
    content TEXT,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_url TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status scheduled_message_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    failure_reason TEXT
);

-- Index for efficient polling
CREATE INDEX idx_scheduled_messages_polling 
ON scheduled_messages (status, scheduled_at) 
WHERE status = 'pending';
