-- High-Scale Real-Time Chat Application - PostgreSQL Schema
-- Optimized for write-heavy loads with 10k concurrent connections

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user lookup
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- ============================================
-- ROOMS TABLE (1-on-1 DMs and Group Chats)
-- ============================================
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100), -- NULL for 1-on-1 DMs, set for group chats
    room_type VARCHAR(20) NOT NULL CHECK (room_type IN ('direct', 'group')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rooms_type ON rooms(room_type);
CREATE INDEX idx_rooms_created_at ON rooms(created_at DESC);

-- ============================================
-- ROOM MEMBERS (Many-to-Many)
-- ============================================
CREATE TABLE room_members (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    
    -- Prevent duplicate memberships
    UNIQUE(room_id, user_id)
);

-- Optimized indexes for membership queries
CREATE INDEX idx_room_members_room ON room_members(room_id) WHERE left_at IS NULL;
CREATE INDEX idx_room_members_user ON room_members(user_id) WHERE left_at IS NULL;

-- ============================================
-- MESSAGES TABLE (Write-Heavy Optimized)
-- ============================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    
    -- Message lifecycle timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    metadata JSONB, -- For attachments, reply_to, etc.
    
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- CRITICAL INDEX: Composite index for fetching messages by room ordered by time
-- This is the most frequent query pattern
CREATE INDEX idx_messages_room_created ON messages(room_id, created_at DESC) 
    WHERE deleted_at IS NULL;

-- Index for sender's messages
CREATE INDEX idx_messages_sender ON messages(sender_id, created_at DESC);

-- BRIN index for time-based queries on very large tables (space efficient)
CREATE INDEX idx_messages_created_brin ON messages USING BRIN(created_at);

-- GIN index for JSONB metadata search (optional, for future features)
CREATE INDEX idx_messages_metadata ON messages USING GIN(metadata);

-- ============================================
-- MESSAGE RECEIPTS (Delivered & Read Status)
-- ============================================
CREATE TABLE message_receipts (
    id SERIAL PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Status tracking
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Prevent duplicate receipts
    UNIQUE(message_id, user_id)
);

-- Optimized indexes for receipt queries
CREATE INDEX idx_receipts_message ON message_receipts(message_id);
CREATE INDEX idx_receipts_user ON message_receipts(user_id);

-- PARTIAL INDEX: Find undelivered messages for a user (offline message queue)
CREATE INDEX idx_receipts_undelivered ON message_receipts(user_id) 
    WHERE delivered_at IS NULL;

-- ============================================
-- USER SESSIONS (Active WebSocket Connections)
-- ============================================
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    socket_id VARCHAR(100) NOT NULL UNIQUE,
    server_instance VARCHAR(100), -- Which backend instance (for debugging)
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- User agent and IP for security
    user_agent TEXT,
    ip_address INET
);

-- Fast lookup for presence queries
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_socket ON user_sessions(socket_id);
CREATE INDEX idx_sessions_heartbeat ON user_sessions(last_heartbeat);

-- ============================================
-- TYPING INDICATORS (Ephemeral, optional to persist)
-- ============================================
-- Note: In production, typing indicators are typically handled in-memory via Redis
-- This table is optional for analytics
CREATE TABLE typing_events (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    stopped_at TIMESTAMP WITH TIME ZONE
);

-- Index for recent typing events
CREATE INDEX idx_typing_room_time ON typing_events(room_id, started_at DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View for active room members
CREATE VIEW active_room_members AS
SELECT 
    rm.room_id,
    rm.user_id,
    u.username,
    u.display_name,
    u.avatar_url,
    rm.role,
    rm.joined_at
FROM room_members rm
JOIN users u ON rm.user_id = u.id
WHERE rm.left_at IS NULL;

-- View for user's active rooms with last message
CREATE VIEW user_rooms_with_last_message AS
SELECT DISTINCT ON (r.id)
    r.id AS room_id,
    r.name,
    r.room_type,
    r.created_at,
    m.id AS last_message_id,
    m.content AS last_message_content,
    m.created_at AS last_message_at,
    u.username AS last_sender_username
FROM rooms r
JOIN room_members rm ON r.id = rm.room_id
LEFT JOIN messages m ON r.id = m.room_id AND m.deleted_at IS NULL
LEFT JOIN users u ON m.sender_id = u.id
WHERE rm.left_at IS NULL
ORDER BY r.id, m.created_at DESC;

-- ============================================
-- PERFORMANCE STATISTICS
-- ============================================

-- Enable query performance tracking
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================
-- SAMPLE DATA (for development/testing)
-- ============================================

-- Insert sample users
INSERT INTO users (username, email, password_hash, display_name) VALUES
('alice', 'alice@example.com', '$2b$10$dummyhash1', 'Alice Smith'),
('bob', 'bob@example.com', '$2b$10$dummyhash2', 'Bob Johnson'),
('charlie', 'charlie@example.com', '$2b$10$dummyhash3', 'Charlie Brown');

-- Insert sample room (1-on-1 DM)
INSERT INTO rooms (name, room_type, created_by) VALUES
(NULL, 'direct', 1);

-- Add members to room
INSERT INTO room_members (room_id, user_id) VALUES
(1, 1),
(1, 2);

-- Insert sample messages
INSERT INTO messages (room_id, sender_id, content) VALUES
(1, 1, 'Hey Bob! How are you?'),
(1, 2, 'Hi Alice! I''m doing great, thanks!');

-- Insert message receipts
INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at)
SELECT id, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM messages WHERE sender_id = 1;

INSERT INTO message_receipts (message_id, user_id, delivered_at, read_at)
SELECT id, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM messages WHERE sender_id = 2;

-- ============================================
-- NOTES ON OPTIMIZATION
-- ============================================

/*
WRITE-HEAVY OPTIMIZATIONS:

1. UUID for message IDs: Enables distributed ID generation without coordination
2. Composite index (room_id, created_at DESC): Optimizes most common query (fetch recent messages)
3. Partial indexes: Only index relevant rows (e.g., WHERE deleted_at IS NULL)
4. BRIN index on created_at: Space-efficient for time-series data
5. Minimal foreign key constraints: Only where data integrity is critical
6. No triggers on messages table: Avoid write amplification

SCALABILITY CONSIDERATIONS:

1. Consider partitioning messages table by created_at after 100M+ rows
2. Use connection pooling (max 20-50 connections per instance)
3. Separate read replicas for analytics queries
4. Archive old messages (>1 year) to cold storage

INDEXES TO MONITOR:

Run this query periodically to check index usage:
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

Drop unused indexes to improve write performance.
*/
