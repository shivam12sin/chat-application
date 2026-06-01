/**
 * Integration tests for health endpoints
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthRoutes from '../../src/routes/health';

// Mock database and redis
vi.mock('../../src/config/database', () => ({
    default: {
        query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
        healthCheck: vi.fn().mockResolvedValue(true),
    },
}));

vi.mock('../../src/config/redis', () => ({
    RedisService: {
        healthCheck: vi.fn().mockResolvedValue(true),
    },
    redisClient: {
        ping: vi.fn().mockResolvedValue('PONG'),
    },
}));

describe('Health Endpoints', () => {
    let app: express.Express;

    beforeAll(() => {
        app = express();
        app.use('/health', healthRoutes);
    });

    describe('GET /health', () => {
        it('should return healthy status when all services are up', async () => {
            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('healthy');
            expect(response.body.checks.database.status).toBe('up');
            expect(response.body.checks.redis.status).toBe('up');
            expect(response.body.timestamp).toBeDefined();
            expect(response.body.uptime).toBeGreaterThan(0);
        });
    });

    describe('GET /health/ready', () => {
        it('should return ready when database is available', async () => {
            const response = await request(app).get('/health/ready');

            expect(response.status).toBe(200);
            expect(response.body.ready).toBe(true);
        });
    });

    describe('GET /health/live', () => {
        it('should always return alive', async () => {
            const response = await request(app).get('/health/live');

            expect(response.status).toBe(200);
            expect(response.body.alive).toBe(true);
        });
    });
});
