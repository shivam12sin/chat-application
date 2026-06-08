import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL Connection Pool Configuration
// Optimized for high concurrency (10k WebSocket connections)
const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chat_platform',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',

    // Connection pool settings for high-scale
    min: parseInt(process.env.DB_POOL_MIN || '5'),
    max: parseInt(process.env.DB_POOL_MAX || '50'), // Limit to prevent DB overload

    // Connection lifecycle
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Fail fast if can't connect

    // Keep connections alive
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,

    // Statement timeout to prevent long-running queries
    statement_timeout: 10000, // 10 seconds max per query
};

class Database {
    private static instance: Database;
    private pool: Pool;

    private constructor() {
        this.pool = new Pool(poolConfig);

        // Handle pool errors
        this.pool.on('error', (err) => {
            console.error('Unexpected database pool error:', err);
        });

        // Log pool stats periodically in development
        if (process.env.NODE_ENV === 'development') {
            setInterval(() => {
                console.log('DB Pool Stats:', {
                    total: this.pool.totalCount,
                    idle: this.pool.idleCount,
                    waiting: this.pool.waitingCount,
                });
            }, 60000); // Every minute
        }
    }

    public static getInstance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    public getPool(): Pool {
        return this.pool;
    }

    public async query(text: string, params?: any[]) {
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;

            // Log slow queries in development
            if (process.env.NODE_ENV === 'development' && duration > 1000) {
                console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
            }

            return result;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    public async getClient(): Promise<PoolClient> {
        return await this.pool.connect();
    }

    public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    public async close(): Promise<void> {
        await this.pool.end();
    }

    // Health check for load balancer
    public async healthCheck(): Promise<boolean> {
        try {
            const result = await this.pool.query('SELECT 1');
            return result.rows.length > 0;
        } catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }
}

export default Database.getInstance();
