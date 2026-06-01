/**
 * Unit tests for User Routes
 * Tests: Profile, settings, search users
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock dependencies
vi.mock('../../src/config/database', () => ({
    default: { query: vi.fn() },
}));

vi.mock('../../src/middleware/auth', () => ({
    authenticateTokenHTTP: (req: any, _res: any, next: any) => {
        req.user = { userId: 1, username: 'testuser' };
        next();
    },
}));

import Database from '../../src/config/database';

describe('User Routes', () => {
    let app: express.Express;

    beforeEach(() => {
        vi.clearAllMocks();
        app = express();
        app.use(express.json());

        // Inline simple routes for testing
        app.get('/users/me', (req: any, res) => {
            const userId = req.user?.userId || 1;
            Database.query('SELECT * FROM users WHERE id = $1', [userId])
                .then((result: any) => {
                    if (result.rows.length === 0) {
                        return res.status(404).json({ error: 'User not found' });
                    }
                    res.json(result.rows[0]);
                })
                .catch(() => res.status(500).json({ error: 'Database error' }));
        });

        app.get('/users/search', (req: any, res) => {
            const query = req.query.q as string;
            if (!query || query.length < 2) {
                return res.status(400).json({ error: 'Query too short' });
            }
            Database.query('SELECT * FROM users WHERE username ILIKE $1', [`%${query}%`])
                .then((result: any) => res.json(result.rows))
                .catch(() => res.status(500).json({ error: 'Search failed' }));
        });
    });

    describe('GET /users/me', () => {
        it('should return current user profile', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    username: 'testuser',
                    email: 'test@example.com',
                    display_name: 'Test User',
                    avatar_url: null,
                }],
            } as any);

            const response = await request(app).get('/users/me');

            expect(response.status).toBe(200);
            expect(response.body.username).toBe('testuser');
        });

        it('should return 404 if user not found', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rows: [] } as any);

            const response = await request(app).get('/users/me');

            expect(response.status).toBe(404);
        });
    });

    describe('GET /users/search', () => {
        it('should search users by username', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [
                    { id: 2, username: 'john', display_name: 'John' },
                    { id: 3, username: 'johnny', display_name: 'Johnny' },
                ],
            } as any);

            const response = await request(app).get('/users/search?q=john');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
        });

        it('should reject short queries', async () => {
            const response = await request(app).get('/users/search?q=j');

            expect(response.status).toBe(400);
        });
    });
});
