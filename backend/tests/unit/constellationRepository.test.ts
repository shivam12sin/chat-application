/**
 * Unit tests for Constellation Repository
 * Tests: CRUD operations for constellations and their messages
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConstellationRepository } from '../../src/repositories/ConstellationRepository';

// Mock database
vi.mock('../../src/config/database', () => ({
    default: {
        query: vi.fn(),
    },
}));

import Database from '../../src/config/database';

describe('Constellation Repository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createConstellation', () => {
        it('should create a new constellation', async () => {
            const mockConstellation = {
                id: 1,
                user_id: 1,
                name: 'My Favorites',
                created_at: new Date(),
            };

            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [mockConstellation],
            });

            const result = await ConstellationRepository.createConstellation(
                1,
                'My Favorites',
                undefined
            );

            expect(result).toEqual(mockConstellation);
            expect(Database.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT'),
                expect.arrayContaining([1, 'My Favorites'])
            );
        });
    });

    describe('getUserConstellations', () => {
        it('should return all constellations for a user', async () => {
            const mockConstellations = [
                { id: 1, name: 'Favorites', message_count: 5 },
                { id: 2, name: 'Important', message_count: 3 },
            ];

            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: mockConstellations,
            });

            const result = await ConstellationRepository.getUserConstellations(1);

            expect(result).toEqual(mockConstellations);
        });
    });

    describe('addMessageToConstellation', () => {
        it('should add a message to a constellation', async () => {
            // First call: verify ownership
            vi.mocked(Database.query)
                .mockResolvedValueOnce({
                    rows: [{ id: 1, user_id: 1 }],
                })
                // Second call: insert message
                .mockResolvedValueOnce({
                    rows: [{ id: 1, constellation_id: 1, message_id: 'msg-123' }],
                })
                // Third call: update timestamp
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await ConstellationRepository.addMessageToConstellation(
                1, // userId
                1, // constellationId
                'msg-123', // messageId
                1 // roomId
            );

            expect(result).toBeDefined();
        });

        it('should return null if constellation not owned by user', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rows: [] });

            const result = await ConstellationRepository.addMessageToConstellation(
                1,
                999, // Non-existent constellation
                'msg-123',
                1
            );

            expect(result).toBeNull();
        });
    });

    describe('removeMessageFromConstellation', () => {
        it('should remove a message from constellation', async () => {
            vi.mocked(Database.query)
                .mockResolvedValueOnce({
                    rows: [{ id: 1, user_id: 1 }],
                })
                .mockResolvedValueOnce({ rowCount: 1 });

            const result = await ConstellationRepository.removeMessageFromConstellation(
                1,
                1,
                'msg-123'
            );

            expect(result).toBe(true);
        });
    });

    describe('deleteConstellation', () => {
        it('should delete a constellation', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rowCount: 1 });

            const result = await ConstellationRepository.deleteConstellation(1, 1);

            expect(result).toBe(true);
        });

        it('should return false if constellation not found', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rowCount: 0 });

            const result = await ConstellationRepository.deleteConstellation(1, 999);

            expect(result).toBe(false);
        });
    });
});
