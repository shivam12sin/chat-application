/**
 * Migration: Add Constellations tables
 * 
 * Constellations are message collections (like playlists for messages).
 * Users can create multiple constellations and add messages from any chat.
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
    console.log('Running Constellations migration...');

    try {
        await client.query('BEGIN');

        // Constellations table - user's message collections
        console.log('Creating constellations table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS constellations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                description VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Index for user lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_constellations_user_id 
            ON constellations(user_id)
        `);

        // Constellation messages - junction table
        // Note: message_id is UUID to match messages table
        console.log('Creating constellation_messages table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS constellation_messages (
                id SERIAL PRIMARY KEY,
                constellation_id INTEGER NOT NULL REFERENCES constellations(id) ON DELETE CASCADE,
                message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
                added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(constellation_id, message_id)
            )
        `);

        // Indexes for lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_constellation_messages_constellation 
            ON constellation_messages(constellation_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_constellation_messages_message 
            ON constellation_messages(message_id)
        `);

        await client.query('COMMIT');
        console.log('✓ Constellations tables created successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }

    await client.end();
}

async function down() {
    await client.connect();
    await client.query('DROP TABLE IF EXISTS constellation_messages CASCADE');
    await client.query('DROP TABLE IF EXISTS constellations CASCADE');
    await client.end();
}

// Run migration
up()
    .then(() => {
        console.log('✓ Constellations migration completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });

module.exports = { up, down };
