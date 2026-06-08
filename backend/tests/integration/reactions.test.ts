/**
 * Integration tests for Message Reaction routes
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import reactionsRouter from '../../src/routes/reactions';
import { ReactionRepository } from '../../src/repositories/ReactionRepository';

// Mock the ReactionRepository methods
vi.mock('../../src/repositories/ReactionRepository', () => ({
    ReactionRepository: {
        toggleReaction: vi.fn(),
        getReactionsForMessage: vi.fn(),
        removeReaction: vi.fn(),
    },
}));

// Mock the authentication middleware
vi.mock('../../src/middleware/auth', () => ({
    authenticateTokenHTTP: (req: any, _res: any, next: any) => {
        // Provide mock user payload containing both id and userId
        req.user = { userId: 42, id: 42, username: 'testuser' };
        next();
    },
}));

describe('Reactions API (Integration)', () => {
    let app: express.Express;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/reactions', reactionsRouter);
    });

    describe('POST /api/reactions/:messageId', () => {
        it('should successfully add/toggle reaction and return reactions list', async () => {
            // Setup mocks
            vi.mocked(ReactionRepository.toggleReaction).mockResolvedValueOnce({ added: true } as any);
            vi.mocked(ReactionRepository.getReactionsForMessage).mockResolvedValueOnce([
                { emoji: '👍', count: 1, user_ids: [42] }
            ] as any);

            const response = await request(app)
                .post('/api/reactions/100')
                .send({ emoji: '👍' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.added).toBe(true);
            expect(response.body.reactions).toBeDefined();
            expect(response.body.reactions[0].emoji).toBe('👍');
            expect(ReactionRepository.toggleReaction).toHaveBeenCalledWith('100', 42, '👍');
        });

        it('should return 400 Bad Request if emoji is missing', async () => {
            const response = await request(app)
                .post('/api/reactions/100')
                .send({}); // No emoji

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Emoji is required');
        });
    });

    describe('GET /api/reactions/:messageId', () => {
        it('should return reactions list for a message', async () => {
            vi.mocked(ReactionRepository.getReactionsForMessage).mockResolvedValueOnce([
                { emoji: '🚀', count: 2, user_ids: [42, 99] }
            ] as any);

            const response = await request(app).get('/api/reactions/100');

            expect(response.status).toBe(200);
            expect(response.body.reactions).toBeDefined();
            expect(response.body.reactions[0].emoji).toBe('🚀');
            expect(ReactionRepository.getReactionsForMessage).toHaveBeenCalledWith('100');
        });
    });

    describe('DELETE /api/reactions/:messageId/:emoji', () => {
        it('should remove a reaction and return updated list', async () => {
            vi.mocked(ReactionRepository.removeReaction).mockResolvedValueOnce(true);
            vi.mocked(ReactionRepository.getReactionsForMessage).mockResolvedValueOnce([] as any);

            const response = await request(app).delete('/api/reactions/100/%F0%9F%91%8D'); // '👍' URI encoded

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.reactions).toEqual([]);
            expect(ReactionRepository.removeReaction).toHaveBeenCalledWith('100', 42, '👍');
        });
    });
});
