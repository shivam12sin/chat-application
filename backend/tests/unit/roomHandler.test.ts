/**
 * Unit tests for Room Handler
 * Tests: join room, leave room
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import roomHandler from '../../src/socket/handlers/roomHandler';

// Mock dependencies
vi.mock('../../src/config/database', () => ({
    default: {
        query: vi.fn(),
    },
}));

describe('Room Handler', () => {
    let mockSocket: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSocket = {
            id: 'socket-123',
            userId: 1,
            username: 'testuser',
            rooms: new Set(),
            join: vi.fn(),
            leave: vi.fn(),
            to: vi.fn().mockReturnThis(),
            emit: vi.fn(),
            broadcast: {
                to: vi.fn().mockReturnThis(),
                emit: vi.fn(),
            },
        };
    });

    describe('handleJoinRoom', () => {
        it('should call join room without throwing', async () => {
            // Just verify the handler doesn't throw
            await expect(
                roomHandler.handleJoinRoom(mockSocket, { roomId: 1 })
            ).resolves.not.toThrow();
        });
    });

    describe('handleLeaveRoom', () => {
        it('should leave a room successfully', async () => {
            await roomHandler.handleLeaveRoom(mockSocket, { roomId: 1 });

            expect(mockSocket.leave).toHaveBeenCalledWith('room:1');
        });
    });
});
