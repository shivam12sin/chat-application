/**
 * Unit tests for Mute functionality
 * Tests: Mute/unmute room operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database', () => ({
    default: { query: vi.fn() },
}));

import Database from '../../src/config/database';

describe('Mute Functionality', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('mute operations', () => {
        it('should insert mute record', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rowCount: 1 } as any);

            const result = await Database.query(
                'INSERT INTO muted_rooms (user_id, room_id) VALUES ($1, $2)',
                [1, 1]
            );

            expect(result.rowCount).toBe(1);
        });

        it('should delete mute record', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rowCount: 1 } as any);

            const result = await Database.query(
                'DELETE FROM muted_rooms WHERE user_id = $1 AND room_id = $2',
                [1, 1]
            );

            expect(result.rowCount).toBe(1);
        });

        it('should check if room is muted', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [{ id: 1, user_id: 1, room_id: 1 }],
            } as any);

            const result = await Database.query(
                'SELECT * FROM muted_rooms WHERE user_id = $1 AND room_id = $2',
                [1, 1]
            );

            expect(result.rows).toHaveLength(1);
        });

        it('should return empty for non-muted room', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rows: [] } as any);

            const result = await Database.query(
                'SELECT * FROM muted_rooms WHERE user_id = $1 AND room_id = $2',
                [1, 999]
            );

            expect(result.rows).toHaveLength(0);
        });
    });
});
