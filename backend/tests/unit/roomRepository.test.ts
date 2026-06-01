/**
 * Unit tests for Room Repository
 * Tests: Room queries and member management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoomRepository } from '../../src/repositories/RoomRepository';

vi.mock('../../src/config/database', () => ({
    default: { query: vi.fn() },
}));

import Database from '../../src/config/database';

describe('Room Repository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getRoomById', () => {
        it('should return room by ID', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [{ id: 1, name: 'Test Room', room_type: 'group' }],
            } as any);

            const result = await RoomRepository.getRoomById(1);

            expect(result).toBeDefined();
            expect(result?.name).toBe('Test Room');
        });

        it('should return null for non-existent room', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rows: [] } as any);

            const result = await RoomRepository.getRoomById(999);

            expect(result).toBeNull();
        });
    });

    describe('getRoomMembers', () => {
        it('should return list of room members', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [
                    { user_id: 1, username: 'user1' },
                    { user_id: 2, username: 'user2' },
                ],
            } as any);

            const result = await RoomRepository.getRoomMembers(1);

            expect(result).toHaveLength(2);
        });
    });

    describe('isUserMemberOfRoom', () => {
        it('should return true if user is member', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [{ user_id: 1 }],
            } as any);

            const result = await RoomRepository.isUserMemberOfRoom(1, 1);

            expect(result).toBe(true);
        });

        it('should return false if user is not member', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rows: [] } as any);

            const result = await RoomRepository.isUserMemberOfRoom(999, 1);

            expect(result).toBe(false);
        });
    });

    describe('addUserToRoom', () => {
        it('should add a user to room', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [{ id: 1, room_id: 1, user_id: 2, role: 'member' }],
            } as any);

            const result = await RoomRepository.addUserToRoom(1, 2);

            expect(result).toBeDefined();
            expect(result.user_id).toBe(2);
        });
    });

    describe('removeUserFromRoom', () => {
        it('should remove a user from room', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rowCount: 1 } as any);

            await RoomRepository.removeUserFromRoom(1, 2);

            expect(Database.query).toHaveBeenCalled();
        });
    });

    describe('getUserRooms', () => {
        it('should return all rooms for a user', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [
                    { id: 1, name: 'Room 1', room_type: 'group' },
                    { id: 2, name: null, room_type: 'direct' },
                ],
            } as any);

            const result = await RoomRepository.getUserRooms(1);

            expect(result).toHaveLength(2);
        });
    });
});
