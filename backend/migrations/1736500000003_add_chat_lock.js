/**
 * Migration: Add is_locked column to room_members table
 * Enables per-user chat lock for individual rooms
 */

require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chat_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
};

async function up() {
    const pool = new Pool(poolConfig);

    try {
        await pool.query(`
            ALTER TABLE room_members 
            ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE
        `);
        console.log('Added is_locked column to room_members');
    } finally {
        await pool.end();
    }
}

async function down() {
    const pool = new Pool(poolConfig);

    try {
        await pool.query(`
            ALTER TABLE room_members 
            DROP COLUMN IF EXISTS is_locked
        `);
        console.log('Removed is_locked column from room_members');
    } finally {
        await pool.end();
    }
}

module.exports = { up, down };

