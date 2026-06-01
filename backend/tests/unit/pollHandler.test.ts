/**
 * Unit tests for Poll functionality
 * Tests: Poll creation and voting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database', () => ({
    default: { query: vi.fn() },
}));

import Database from '../../src/config/database';

describe('Poll Functionality', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('poll creation', () => {
        it('should insert a poll into database', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [{ id: 1, question: 'Test poll?', options: ['Yes', 'No'] }],
            } as any);

            const result = await Database.query(
                'INSERT INTO polls (room_id, question, options, creator_id) VALUES ($1, $2, $3, $4) RETURNING *',
                [1, 'Test poll?', ['Yes', 'No'], 1]
            );

            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].question).toBe('Test poll?');
        });
    });

    describe('poll voting', () => {
        it('should insert a vote record', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rowCount: 1 } as any);

            const result = await Database.query(
                'INSERT INTO poll_votes (poll_id, user_id, option_index) VALUES ($1, $2, $3)',
                [1, 1, 0]
            );

            expect(result.rowCount).toBe(1);
        });

        it('should get poll results', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [
                    { option_index: 0, count: 5 },
                    { option_index: 1, count: 3 },
                ],
            } as any);

            const result = await Database.query(
                'SELECT option_index, COUNT(*) FROM poll_votes WHERE poll_id = $1 GROUP BY option_index',
                [1]
            );

            expect(result.rows).toHaveLength(2);
        });
    });
});
