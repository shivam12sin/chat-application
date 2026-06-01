/**
 * Unit tests for Message Repository
 * Tests: CRUD operations for messages
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageRepository } from '../../src/repositories/MessageRepository';

// Mock database
vi.mock('../../src/config/database', () => ({
    default: {
        query: vi.fn(),
    },
}));

import Database from '../../src/config/database';

describe('Message Repository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createMessage', () => {
        it('should create a new message', async () => {
            const mockMessage = {
                id: 'uuid-123',
                sender_id: 1,
                room_id: 1,
                content: 'Hello!',
                message_type: 'text',
                created_at: new Date(),
            };

            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [mockMessage],
            } as any);

            const result = await MessageRepository.createMessage({
                roomId: 1,
                senderId: 1,
                content: 'Hello!',
                messageType: 'text',
            });

            expect(result).toEqual(mockMessage);
            expect(Database.query).toHaveBeenCalled();
        });
    });

    describe('getMessageById', () => {
        it('should return message by ID', async () => {
            const mockMessage = {
                id: 'uuid-123',
                content: 'Hello!',
            };

            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [mockMessage],
            } as any);

            const result = await MessageRepository.getMessageById('uuid-123');

            expect(result).toEqual(mockMessage);
        });

        it('should return null for non-existent message', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rows: [] } as any);

            const result = await MessageRepository.getMessageById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('getMessagesByRoom', () => {
        it('should return messages for a room with pagination', async () => {
            const mockMessages = [
                { id: 'msg-1', content: 'First' },
                { id: 'msg-2', content: 'Second' },
            ];

            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: mockMessages,
            } as any);

            const result = await MessageRepository.getMessagesByRoom(1, 50);

            expect(result.messages).toBeDefined();
        });
    });

    describe('markAsDelivered', () => {
        it('should mark message as delivered (returns void)', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rowCount: 1 } as any);

            // This method returns void, not boolean
            await MessageRepository.markAsDelivered('msg-123', 1);

            expect(Database.query).toHaveBeenCalled();
        });
    });

    describe('markAsRead', () => {
        it('should mark message as read (returns void)', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rowCount: 1 } as any);

            // This method returns void, not boolean
            await MessageRepository.markAsRead('msg-123', 1);

            expect(Database.query).toHaveBeenCalled();
        });
    });

    describe('pinMessage', () => {
        it('should pin a message', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rowCount: 1 } as any);

            await MessageRepository.pinMessage('msg-123');

            expect(Database.query).toHaveBeenCalledWith(
                expect.stringContaining('is_pinned'),
                expect.arrayContaining(['msg-123'])
            );
        });
    });
});
