import fs from 'fs';
import path from 'path';
import Database from './database';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

  // 2. Run pending JS migrations using node-pg-migrate
  try {
    console.log(
      'Database Initializer: Checking for pending JS migrations managed by node-pg-migrate...'
    );

    // Ensure DATABASE_URL is set so node-pg-migrate can connect
    const databaseUrl = getDbConnectionString();
    const env: Record<string, string | undefined> = {
      ...process.env,
      DATABASE_URL: databaseUrl,
    };

    // If DATABASE_URL is present (e.g. on Render), enforce SSL and bypass self-signed certificate validation
    if (process.env.DATABASE_URL) {
      env.PGSSLMODE = 'require';
      env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    console.log('Database Initializer: Spawning "npx node-pg-migrate up"...');
    // Run npx node-pg-migrate up in the application directory
    const { stdout, stderr } = await execAsync('npx node-pg-migrate up', {
      cwd: process.cwd(),
      env,
    });

    if (stdout && stdout.trim()) {
      console.log('Database Initializer: node-pg-migrate stdout:\n', stdout);
    }
    if (stderr && stderr.trim()) {
      console.warn('Database Initializer: node-pg-migrate stderr:\n', stderr);
    }
    console.log('Database Initializer: ✓ All JS migrations checked and applied.');
  } catch (error) {
    console.error('Database Initializer: ERROR running JS migrations:', error);
    throw error;
  }
}
