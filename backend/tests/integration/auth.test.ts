/**
 * Integration tests for Auth Flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/routes/auth';

// Mock dependencies
vi.mock('../../src/config/database', () => ({
    default: { query: vi.fn() },
}));

vi.mock('bcrypt', () => ({
    default: {
        compare: vi.fn().mockResolvedValue(true),
        hash: vi.fn().mockResolvedValue('hashed-password'),
    },
}));

vi.mock('../../src/utils/jwt', () => ({
    generateTokenPair: vi.fn().mockReturnValue({
        accessToken: 'integration-test-token',
        refreshToken: 'integration-refresh-token',
        expiresIn: 3600,
    }),
}));

import Database from '../../src/config/database';

describe('Auth Flow Integration', () => {
    let app: express.Express;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/auth', authRoutes);
        vi.clearAllMocks();
    });

    describe('Login Flow', () => {
        it('should login and return tokens', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    username: 'logintest',
                    email: 'logintest@example.com',
                    password_hash: 'hashed-password',
                    two_factor_enabled: false,
                    display_name: 'Login Test',
                    avatar_url: null,
                }],
            } as any);

            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'logintest@example.com',
                    password: 'password123',
                });

            expect(response.status).toBe(200);
            expect(response.body.accessToken).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should return 400 for malformed requests', async () => {
            const response = await request(app)
                .post('/auth/register')
                .send({ invalid: 'data' });

            expect(response.status).toBe(400);
        });

        it('should return 401 for invalid credentials', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rows: [] } as any);

            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'wrongpassword',
                });

            expect(response.status).toBe(401);
        });
    });
});
