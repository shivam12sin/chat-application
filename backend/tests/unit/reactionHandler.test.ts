/**
 * Unit tests for Reaction Handler
 * Tests: toggle reaction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import reactionHandler from '../../src/socket/handlers/reactionHandler';

// Mock dependencies
vi.mock('../../src/config/database', () => ({
    default: {
        query: vi.fn(),
    },
}));

import Database from '../../src/config/database';

describe('Reaction Handler', () => {
    let mockSocket: any;
    let mockCallback: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockCallback = vi.fn();

        mockSocket = {
            id: 'socket-123',
            userId: 1,
            username: 'testuser',
            to: vi.fn().mockReturnThis(),
            emit: vi.fn(),
        };
    });

    describe('handleToggleReaction', () => {
        it('should call toggle reaction with valid data', async () => {
            // Mock message exists check
            vi.mocked(Database.query)
                .mockResolvedValueOnce({ rows: [{ id: 'msg-123' }] } as any) // Message exists
                .mockResolvedValueOnce({ rows: [] } as any) // No existing reaction
                .mockResolvedValueOnce({ rows: [{ id: 1 }] } as any) // Insert reaction
                .mockResolvedValueOnce({ rows: [{ emoji: '👍', count: 1 }] } as any); // Get counts

            await reactionHandler.handleToggleReaction(
                mockSocket,
                { messageId: 'msg-123', roomId: 1, emoji: '👍' },
                mockCallback
            );

            // Handler was called
            expect(mockCallback).toHaveBeenCalled();
        });

        it('should reject empty emoji', async () => {
            await reactionHandler.handleToggleReaction(
                mockSocket,
                { messageId: 'msg-123', roomId: 1, emoji: '' },
                mockCallback
            );

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(String),
                })
            );
        });

        it('should reject missing messageId', async () => {
            await reactionHandler.handleToggleReaction(
                mockSocket,
                { messageId: '', roomId: 1, emoji: '👍' },
                mockCallback
            );

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(String),
                })
            );
        });
    });
});
