/**
 * Unit tests for Authentication Routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../../src/routes/auth';

// Mock all dependencies at top level
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
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
    }),
}));

import Database from '../../src/config/database';
import bcrypt from 'bcrypt';

describe('Auth Routes', () => {
    let app: express.Express;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/auth', authRoutes);
        vi.clearAllMocks();
    });

    describe('POST /auth/register', () => {
        it('should reject duplicate username with 409', async () => {
            const duplicateError = new Error('Duplicate') as any;
            duplicateError.code = '23505';
            duplicateError.constraint = 'users_username_key';

            vi.mocked(Database.query).mockRejectedValueOnce(duplicateError);

            const response = await request(app)
                .post('/auth/register')
                .send({
                    username: 'testuser',
                    email: 'test@example.com',
                    password: 'password123',
                });

            expect(response.status).toBe(409);
            expect(response.body.error).toContain('already');
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/auth/register')
                .send({ username: 'test' });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /auth/login', () => {
        it('should login with valid credentials', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    username: 'testuser',
                    email: 'test@example.com',
                    password_hash: 'hashed-password',
                    two_factor_enabled: false,
                    display_name: 'Test User',
                    avatar_url: null,
                }],
            } as any);

            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                });

            expect(response.status).toBe(200);
            expect(response.body.accessToken).toBeDefined();
        });

        it('should reject invalid password', async () => {
            vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    username: 'testuser',
                    password_hash: 'hashed-password',
                }],
            } as any);

            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword',
                });

            expect(response.status).toBe(401);
        });

        it('should reject non-existent user', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rows: [] } as any);

            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'notexist@example.com',
                    password: 'password123',
                });

            expect(response.status).toBe(401);
        });

        it('should trigger 2FA challenge when enabled', async () => {
            vi.mocked(Database.query)
                .mockResolvedValueOnce({
                    rows: [{
                        id: 1,
                        username: 'testuser',
                        password_hash: 'hashed-password',
                        two_factor_enabled: true,
                        two_factor_method: 'email',
                        email: 'test@example.com',
                    }],
                } as any)
                .mockResolvedValueOnce({ rows: [] } as any);

            const response = await request(app)
                .post('/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                });

            expect(response.status).toBe(200);
            expect(response.body.requires2FA).toBe(true);
        });
    });

    describe('POST /auth/logout', () => {
        it('should logout successfully', async () => {
            const response = await request(app).post('/auth/logout');
            expect(response.status).toBe(200);
        });
    });
});
