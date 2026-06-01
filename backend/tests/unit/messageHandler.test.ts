/**
 * Unit tests for Socket Message Handler
 * Tests: send message, message delivered, message read
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import messageHandler from '../../src/socket/handlers/messageHandler';

// Mock dependencies
vi.mock('../../src/config/database', () => ({
    default: {
        query: vi.fn(),
    },
}));

vi.mock('../../src/repositories/MessageRepository', () => ({
    MessageRepository: {
        createMessage: vi.fn(),
        getMessageById: vi.fn(),
        markAsDelivered: vi.fn(),
        markAsRead: vi.fn(),
    },
}));

vi.mock('../../src/repositories/RoomRepository', () => ({
    RoomRepository: {
        getRoomDetails: vi.fn(),
        isRoomMember: vi.fn(),
        getRoomMembers: vi.fn(),
    },
}));

vi.mock('../../src/repositories/BlockRepository', () => ({
    BlockRepository: {
        isBlocked: vi.fn().mockResolvedValue(false),
    },
}));

vi.mock('../../src/config/redis', () => ({
    RedisService: {
        rateLimitCheck: vi.fn().mockResolvedValue({ allowed: true }),
    },
}));

import { MessageRepository } from '../../src/repositories/MessageRepository';
import { RoomRepository } from '../../src/repositories/RoomRepository';

describe('Message Handler', () => {
    let mockSocket: any;
    let mockCallback: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockCallback = vi.fn();

        mockSocket = {
            id: 'socket-123',
            userId: 1,
            username: 'testuser',
            rooms: new Set(['room:1']),
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

    describe('handleSendMessage', () => {
        it('should send a text message successfully', async () => {
            vi.mocked(RoomRepository.getRoomDetails).mockResolvedValueOnce({
                id: 1, name: 'Test Room', room_type: 'group'
            } as any);

            vi.mocked(RoomRepository.isRoomMember).mockResolvedValueOnce(true);
            vi.mocked(RoomRepository.getRoomMembers).mockResolvedValueOnce([
                { user_id: 1 }, { user_id: 2 }
            ] as any);

            vi.mocked(MessageRepository.createMessage).mockResolvedValueOnce({
                id: 'msg-uuid-123',
                sender_id: 1,
                room_id: 1,
                content: 'Hello, World!',
                message_type: 'text',
                created_at: new Date(),
            });

            const messageData = {
                roomId: 1,
                content: 'Hello, World!',
                messageType: 'text' as const,
                tempId: 'temp-123',
            };

            await messageHandler.handleSendMessage(mockSocket, messageData, mockCallback);

            expect(mockCallback).toHaveBeenCalled();
        });

        it('should reject empty message content', async () => {
            const messageData = {
                roomId: 1,
                content: '',
                messageType: 'text' as const,
                tempId: 'temp-123',
            };

            await messageHandler.handleSendMessage(mockSocket, messageData, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(String),
                })
            );
        });
    });

    describe('handleMessageDelivered', () => {
        it('should mark message as delivered', async () => {
            vi.mocked(MessageRepository.markAsDelivered).mockResolvedValueOnce(undefined);

            await messageHandler.handleMessageDelivered(mockSocket, {
                messageId: 'msg-123',
                roomId: 1,
            });

            expect(MessageRepository.markAsDelivered).toHaveBeenCalledWith('msg-123', 1);
        });
    });

    describe('handleMessageRead', () => {
        it('should mark message as read', async () => {
            vi.mocked(MessageRepository.markAsRead).mockResolvedValueOnce(undefined);

            await messageHandler.handleMessageRead(mockSocket, {
                messageId: 'msg-123',
                roomId: 1,
            });

            expect(MessageRepository.markAsRead).toHaveBeenCalledWith('msg-123', 1);
        });
    });
});
