import { Router, Request, Response } from 'express';
import Database from '../config/database';
import { RedisService } from '../config/redis';

const router = Router();

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    checks: {
        database: { status: 'up' | 'down'; latencyMs?: number; error?: string };
        redis: { status: 'up' | 'down'; latencyMs?: number; error?: string };
    };
}

/**
 * Comprehensive health check endpoint
 * GET /health
 */
router.get('/', async (_req: Request, res: Response) => {
    const health: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        checks: {
            database: { status: 'up' },
            redis: { status: 'up' },
        },
    };

    // Check database
    try {
        const dbStart = Date.now();
        await Database.query('SELECT 1');
        health.checks.database.latencyMs = Date.now() - dbStart;
    } catch (error) {
        health.checks.database.status = 'down';
        health.checks.database.error = error instanceof Error ? error.message : 'Unknown error';
        health.status = 'unhealthy';
    }

    // Check Redis
    try {
        const redisStart = Date.now();
        const isHealthy = await RedisService.healthCheck();
        health.checks.redis.latencyMs = Date.now() - redisStart;
        if (!isHealthy) {
            health.checks.redis.status = 'down';
            health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded';
        }
    } catch (error) {
        health.checks.redis.status = 'down';
        health.checks.redis.error = error instanceof Error ? error.message : 'Unknown error';
        health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
});

/**
 * Readiness probe (for Kubernetes)
 * Returns 200 only if the service can accept traffic
 */
router.get('/ready', async (_req: Request, res: Response) => {
    try {
        await Database.query('SELECT 1');
        res.status(200).json({ ready: true });
    } catch {
        res.status(503).json({ ready: false, message: 'Database not ready' });
    }
});

/**
 * Liveness probe (for Kubernetes)
 * Returns 200 if the process is running
 */
router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({ alive: true });
});

export default router;
