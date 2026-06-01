const { Client } = require('pg');

const client = new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'chat_postgres', // Updated to match Docker service name
    database: process.env.DB_NAME || 'chat_platform',
    password: process.env.DB_PASSWORD || 'postgres',
    port: 5432,
});

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to database');

        // Ensure default room exists
        const res = await client.query(`
            INSERT INTO rooms (id, name, room_type, created_by)
            VALUES (1, 'General', 'group', 1)
            ON CONFLICT (id) DO UPDATE 
            SET name = 'General'
            RETURNING *
        `);

        console.log('Default room ensured:', res.rows[0]);

        await client.end();
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
