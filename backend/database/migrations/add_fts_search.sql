-- Full-Text Search Migration for Messages
-- Run this on your PostgreSQL database

-- Add search vector column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing messages with search vectors
UPDATE messages SET search_vector = to_tsvector('english', content) WHERE search_vector IS NULL;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_messages_fts ON messages USING GIN(search_vector);

-- Create trigger function to auto-update search vector
CREATE OR REPLACE FUNCTION messages_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS messages_search_update ON messages;

-- Create trigger to auto-update on insert/update
CREATE TRIGGER messages_search_update
BEFORE INSERT OR UPDATE OF content ON messages
FOR EACH ROW EXECUTE FUNCTION messages_search_vector_trigger();

-- Verify index was created
-- SELECT indexname FROM pg_indexes WHERE tablename = 'messages';
