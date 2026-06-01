/**
 * E2E Encryption Database Migration
 * 
 * This migration adds the necessary tables for end-to-end encryption:
 * - user_keys: Stores public key bundles (identity key, signed prekey)
 * - one_time_prekeys: Single-use prekeys for X3DH key agreement
 * - e2e_sessions: Encrypted session state between users
 * - Modifies messages table to support encrypted content
 */

const { Client } = require('pg');

const client = new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'chat_platform',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function up() {
    await client.connect();
    console.log('Running E2E encryption migration...');

    try {
        await client.query('BEGIN');

        // ============================================
        // USER KEYS TABLE
        // Stores the public portion of user's key bundle
        // Private keys NEVER leave the client device
        // ============================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_keys (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                
                -- Identity Key (long-term, changes only on account reset)
                -- X25519 public key (32 bytes)
                identity_public_key BYTEA NOT NULL,
                
                -- Signed Pre-Key (medium-term, rotates every 7-30 days)
                -- X25519 public key (32 bytes)
                signed_prekey_public BYTEA NOT NULL,
                signed_prekey_id INTEGER NOT NULL,
                -- Ed25519 signature of the signed prekey (64 bytes)
                signed_prekey_signature BYTEA NOT NULL,
                
                -- Registration ID (random 16-bit, for multi-device disambiguation)
                registration_id INTEGER NOT NULL,
                
                -- Timestamps
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                signed_prekey_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                -- One user = one key bundle (multi-device handled separately)
                UNIQUE(user_id)
            );
        `);
        console.log('✓ Created user_keys table');

        // Index for fast key lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_user_keys_user_id ON user_keys(user_id);
        `);

        // ============================================
        // ONE-TIME PREKEYS TABLE
        // Single-use keys for initial X3DH key agreement
        // Provides forward secrecy for the first message
        // ============================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS one_time_prekeys (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                
                -- Key identifier (unique per user)
                key_id INTEGER NOT NULL,
                
                -- X25519 public key (32 bytes)
                public_key BYTEA NOT NULL,
                
                -- Whether this key has been consumed
                used BOOLEAN DEFAULT FALSE,
                used_at TIMESTAMP WITH TIME ZONE,
                used_by_user_id INTEGER REFERENCES users(id),
                
                -- Upload timestamp
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                -- Each key_id unique per user
                UNIQUE(user_id, key_id)
            );
        `);
        console.log('✓ Created one_time_prekeys table');

        // Index for fetching available prekeys
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_one_time_prekeys_available 
            ON one_time_prekeys(user_id, used) 
            WHERE used = FALSE;
        `);

        // ============================================
        // E2E SESSIONS TABLE
        // Stores encrypted Double Ratchet session state
        // Session state is encrypted with user's local key
        // ============================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS e2e_sessions (
                id SERIAL PRIMARY KEY,
                
                -- Owner of this session record
                owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                
                -- The other participant
                peer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                
                -- For group chats: which room this session is for (NULL for DMs)
                room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
                
                -- Encrypted session state (Double Ratchet state)
                -- Encrypted client-side, server cannot read
                encrypted_session_state BYTEA,
                
                -- Session metadata (for client-side management)
                session_version INTEGER DEFAULT 1,
                
                -- Timestamps
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_message_at TIMESTAMP WITH TIME ZONE,
                
                -- One session per user pair (or per user-room for groups)
                UNIQUE(owner_user_id, peer_user_id, room_id)
            );
        `);
        console.log('✓ Created e2e_sessions table');

        // Indexes for session lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_e2e_sessions_owner ON e2e_sessions(owner_user_id);
            CREATE INDEX IF NOT EXISTS idx_e2e_sessions_peer ON e2e_sessions(peer_user_id);
            CREATE INDEX IF NOT EXISTS idx_e2e_sessions_room ON e2e_sessions(room_id) WHERE room_id IS NOT NULL;
        `);

        // ============================================
        // DEVICE KEYS TABLE (for multi-device support)
        // Each device has its own key bundle
        // ============================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS device_keys (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                
                -- Device identifier (random UUID generated on device)
                device_id UUID NOT NULL,
                device_name VARCHAR(100),
                
                -- Device's identity public key
                device_identity_public_key BYTEA NOT NULL,
                
                -- Device's signed prekey
                device_signed_prekey_public BYTEA NOT NULL,
                device_signed_prekey_id INTEGER NOT NULL,
                device_signed_prekey_signature BYTEA NOT NULL,
                
                -- Device registration ID
                device_registration_id INTEGER NOT NULL,
                
                -- Verification status (verified by another device)
                is_verified BOOLEAN DEFAULT FALSE,
                verified_at TIMESTAMP WITH TIME ZONE,
                verified_by_device_id UUID,
                
                -- Last activity
                last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                -- Timestamps
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                UNIQUE(user_id, device_id)
            );
        `);
        console.log('✓ Created device_keys table');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_device_keys_user ON device_keys(user_id);
            CREATE INDEX IF NOT EXISTS idx_device_keys_device ON device_keys(device_id);
        `);

        // ============================================
        // GROUP SENDER KEYS TABLE
        // For efficient group message encryption (Sender Keys protocol)
        // ============================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS group_sender_keys (
                id SERIAL PRIMARY KEY,
                
                -- The room this sender key is for
                room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
                
                -- The user who owns this sender key
                sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                
                -- Public distribution key (distributed to group members)
                distribution_key_public BYTEA NOT NULL,
                distribution_key_id INTEGER NOT NULL,
                
                -- Chain key iteration (for message ordering)
                chain_iteration INTEGER DEFAULT 0,
                
                -- Timestamps
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                UNIQUE(room_id, sender_user_id)
            );
        `);
        console.log('✓ Created group_sender_keys table');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_group_sender_keys_room ON group_sender_keys(room_id);
        `);

        // ============================================
        // MODIFY MESSAGES TABLE
        // Add columns for encrypted content
        // ============================================
        
        // Check if columns already exist
        const columnCheck = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'messages' AND column_name = 'ciphertext';
        `);

        if (columnCheck.rows.length === 0) {
            await client.query(`
                ALTER TABLE messages 
                ADD COLUMN ciphertext BYTEA,
                ADD COLUMN encryption_version INTEGER DEFAULT 0,
                ADD COLUMN sender_device_id UUID,
                ADD COLUMN message_key_hash BYTEA;
            `);
            console.log('✓ Added encryption columns to messages table');

            // Add comment explaining the columns
            await client.query(`
                COMMENT ON COLUMN messages.ciphertext IS 'AES-256-GCM encrypted message content';
                COMMENT ON COLUMN messages.encryption_version IS '0=plaintext, 1=E2E encrypted';
                COMMENT ON COLUMN messages.sender_device_id IS 'Device that sent this message';
                COMMENT ON COLUMN messages.message_key_hash IS 'Hash of message key for deduplication';
            `);
        }

        // ============================================
        // KEY ROTATION HISTORY
        // Track key rotations for audit purposes
        // ============================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS key_rotation_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                
                key_type VARCHAR(20) NOT NULL CHECK (key_type IN ('identity', 'signed_prekey', 'sender_key')),
                old_key_id INTEGER,
                new_key_id INTEGER NOT NULL,
                
                rotation_reason VARCHAR(50), -- 'scheduled', 'manual', 'compromise', 'member_change'
                
                rotated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ Created key_rotation_history table');

        await client.query('COMMIT');
        console.log('✓ E2E encryption migration completed successfully');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await client.end();
    }
}

async function down() {
    await client.connect();
    console.log('Rolling back E2E encryption migration...');

    try {
        await client.query('BEGIN');

        // Remove columns from messages
        await client.query(`
            ALTER TABLE messages 
            DROP COLUMN IF EXISTS ciphertext,
            DROP COLUMN IF EXISTS encryption_version,
            DROP COLUMN IF EXISTS sender_device_id,
            DROP COLUMN IF EXISTS message_key_hash;
        `);

        // Drop tables in reverse order (respecting foreign keys)
        await client.query('DROP TABLE IF EXISTS key_rotation_history CASCADE;');
        await client.query('DROP TABLE IF EXISTS group_sender_keys CASCADE;');
        await client.query('DROP TABLE IF EXISTS device_keys CASCADE;');
        await client.query('DROP TABLE IF EXISTS e2e_sessions CASCADE;');
        await client.query('DROP TABLE IF EXISTS one_time_prekeys CASCADE;');
        await client.query('DROP TABLE IF EXISTS user_keys CASCADE;');

        await client.query('COMMIT');
        console.log('✓ E2E encryption migration rolled back');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Rollback failed:', error);
        throw error;
    } finally {
        await client.end();
    }
}

// Run migration
if (require.main === module) {
    const action = process.argv[2] || 'up';
    if (action === 'down') {
        down().catch(console.error);
    } else {
        up().catch(console.error);
    }
}

module.exports = { up, down };
