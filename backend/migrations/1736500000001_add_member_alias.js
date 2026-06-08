/**
 * Migration: Add alias column to room_members
 * 
 * Allows users to set a custom alias/tag in each group/space
 * Similar to WhatsApp member tags
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
    console.log('Adding alias column to room_members...');

    try {
        await client.query(`
            ALTER TABLE room_members 
            ADD COLUMN IF NOT EXISTS alias VARCHAR(50) DEFAULT NULL
        `);
        console.log('✓ Added alias column to room_members');
    } catch (error) {
        if (error.code === '42701') {
            console.log('✓ alias column already exists');
        } else {
            throw error;
        }
    }

    await client.end();
}

async function down() {
    await client.connect();
    await client.query(`
        ALTER TABLE room_members DROP COLUMN IF EXISTS alias
    `);
    await client.end();
}

// Run migration
up()
    .then(() => {
        console.log('✓ Member alias migration completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });

module.exports = { up, down };
