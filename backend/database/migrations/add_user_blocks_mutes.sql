-- Block table: user A blocks user B
CREATE TABLE user_blocks (
    id SERIAL PRIMARY KEY,
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- Mute table: user mutes another user or a room
CREATE TABLE user_mutes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    muted_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    muted_room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    mute_until TIMESTAMPTZ,  -- NULL = permanent
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (muted_user_id IS NOT NULL OR muted_room_id IS NOT NULL)
);

CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_id);
CREATE INDEX idx_user_mutes_user ON user_mutes(user_id);
