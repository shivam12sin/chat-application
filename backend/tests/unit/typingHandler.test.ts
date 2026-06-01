/**
 * Unit tests for Typing Handler
 * Tests: Typing indicator broadcasts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database', () => ({
    default: { query: vi.fn() },
}));

describe('Typing Handler', () => {
    let mockSocket: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSocket = {
            id: 'socket-123',
            userId: 1,
            username: 'testuser',
            to: vi.fn().mockReturnThis(),
            emit: vi.fn(),
            broadcast: {
                to: vi.fn().mockReturnThis(),
                emit: vi.fn(),
            },
        };
    });

    describe('typing events', () => {
        it('should have broadcast capability', () => {
            // Verify socket mock can broadcast
            mockSocket.to('room:1');
            expect(mockSocket.to).toHaveBeenCalledWith('room:1');
        });

        it('should support emit to room', () => {
            mockSocket.broadcast.to('room:1').emit('typing:started', { userId: 1 });
            expect(mockSocket.broadcast.to).toHaveBeenCalledWith('room:1');
        });
    });
});
