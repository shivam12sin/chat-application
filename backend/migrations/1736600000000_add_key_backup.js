/**
 * Add Key Backup Table
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
    console.log('Running Key Backup migration...');

    try {
        await client.query('BEGIN');

        // ============================================
        // KEY BACKUPS TABLE
        // Stores encrypted key backup for user
        // ============================================
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_key_backups (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                
                -- Encrypted Backup Data (JSON blob encrypted with password)
                -- We store it as TEXT.
                backup_data TEXT NOT NULL,
                
                -- Metadata
                version INTEGER DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                UNIQUE(user_id)
            );
        `);
        console.log('✓ Created user_key_backups table');

        await client.query('COMMIT');
        console.log('✓ Key Backup migration completed successfullly');

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
    console.log('Rolling back Key Backup migration...');

    try {
        await client.query('BEGIN');

        await client.query('DROP TABLE IF EXISTS user_key_backups CASCADE;');

        await client.query('COMMIT');
        console.log('✓ Key Backup migration rolled back');

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
