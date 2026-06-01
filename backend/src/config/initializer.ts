import fs from 'fs';
import path from 'path';
import Database from './database';
import migrationRunner from 'node-pg-migrate';

function getDbConnectionString(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'chat_platform';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

function parseConnectionString(urlStr: string) {
  try {
    const parsed = new URL(urlStr);
    return {
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: decodeURIComponent(parsed.pathname.substring(1)),
    };
  } catch (err) {
    console.error('Database Initializer: Error parsing database URL:', err);
  }
  return null;
}

export async function initializeDatabase(): Promise<void> {
  console.log('Database Initializer: Starting database schema and migration checks...');

  // 1. Check if base tables exist (by checking if 'users' table exists)
  try {
    const tableCheck = await Database.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'users'
      );
    `);

    const hasUsersTable = tableCheck.rows[0]?.exists;

    if (!hasUsersTable) {
      console.log(
        'Database Initializer: Base table "users" not found. Initializing a fresh database schema...'
      );

      // Execute database/schema.sql
      const schemaPath = path.join(process.cwd(), 'database/schema.sql');
      console.log(`Database Initializer: Reading base schema from ${schemaPath}`);
      if (!fs.existsSync(schemaPath)) {
        throw new Error(`Base schema file not found at path: ${schemaPath}`);
      }
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      console.log('Database Initializer: Executing base schema...');
      await Database.query(schemaSql);
      console.log('Database Initializer: ✓ Base schema executed successfully.');

      // Execute all SQL migrations in database/migrations/
      const migrationsDir = path.join(process.cwd(), 'database/migrations');
      console.log(`Database Initializer: Reading base migrations from ${migrationsDir}`);
      if (fs.existsSync(migrationsDir)) {
        const files = fs
          .readdirSync(migrationsDir)
          .filter(f => f.endsWith('.sql'))
          .sort(); // Run in sorted alphabetical order

        for (const file of files) {
          const filePath = path.join(migrationsDir, file);
          console.log(`Database Initializer: Running migration ${file}...`);
          const sql = fs.readFileSync(filePath, 'utf8');
          await Database.query(sql);
          console.log(`Database Initializer: ✓ Migration ${file} executed successfully.`);
        }
      } else {
        console.warn(`Database Initializer: Migrations directory not found at ${migrationsDir}`);
      }
    } else {
      console.log('Database Initializer: Database base tables already exist.');
    }
  } catch (error) {
    console.error('Database Initializer: ERROR during base schema/migration execution:', error);
    throw error;
  }

  // 2. Run pending JS migrations programmatically
  try {
    console.log(
      'Database Initializer: Checking for pending JS migrations managed by node-pg-migrate...'
    );

    // Parse and set environment variables on process.env so the individual JS migration files can read them
    const databaseUrl = getDbConnectionString();
    const parsedParams = parseConnectionString(databaseUrl);
    if (parsedParams) {
      process.env.DB_USER = parsedParams.user;
      process.env.DB_PASSWORD = parsedParams.password;
      process.env.DB_HOST = parsedParams.host;
      process.env.DB_PORT = parsedParams.port;
      process.env.DB_NAME = parsedParams.database;
    }

    if (process.env.DATABASE_URL) {
      process.env.PGSSLMODE = 'require';
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    // Clean up duplicate tables from half-migrated state to avoid relation already exists crashes
    try {
      const pgmigrationsTableExists = await Database.query(`
        SELECT EXISTS (
          SELECT FROM pg_tables 
          WHERE schemaname = 'public' 
          AND tablename = 'pgmigrations'
        );
      `);

      if (pgmigrationsTableExists.rows[0]?.exists) {
        const migrationChecked = await Database.query(`
          SELECT name FROM pgmigrations WHERE name = '1765268078300_add-contacts';
        `);
        if (migrationChecked.rows.length === 0) {
          console.log(
            'Database Initializer: Clean up duplicate tables from half-migrated state...'
          );
          await Database.query('DROP TABLE IF EXISTS friend_requests CASCADE;');
          await Database.query('DROP TABLE IF EXISTS contacts CASCADE;');
        }
      } else {
        console.log('Database Initializer: Clean up duplicate tables on initial start...');
        await Database.query('DROP TABLE IF EXISTS friend_requests CASCADE;');
        await Database.query('DROP TABLE IF EXISTS contacts CASCADE;');
      }
    } catch (err) {
      console.warn(
        'Database Initializer: Warning during duplicate table cleanup (non-fatal):',
        err
      );
    }

    // Configure the ClientConfig for node-pg-migrate
    const dbConfig = process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: {
            rejectUnauthorized: false,
          },
        }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME || 'chat_platform',
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
        };

    console.log('Database Initializer: Calling node-pg-migrate runner programmatically...');
    await migrationRunner({
      databaseUrl: dbConfig,
      dir: path.join(process.cwd(), 'migrations'),
      direction: 'up',
      migrationsTable: 'pgmigrations',
      verbose: true,
    });

    console.log('Database Initializer: ✓ All JS migrations checked and applied programmatically.');
  } catch (error) {
    console.error('Database Initializer: ERROR running JS migrations:', error);
    throw error;
  }
}
