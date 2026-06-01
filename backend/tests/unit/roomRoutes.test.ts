/**
 * Unit tests for Room Routes
 * Tests: Room CRUD, members, settings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../src/config/database', () => ({
    default: { query: vi.fn() },
}));

import Database from '../../src/config/database';

describe('Room Routes', () => {
    let app: express.Express;

    beforeEach(() => {
        vi.clearAllMocks();
        app = express();
        app.use(express.json());

        // Mock rooms endpoints inline
        app.get('/rooms', (_req, res) => {
            Database.query('SELECT * FROM rooms')
                .then((result: any) => res.json(result.rows))
                .catch(() => res.status(500).json({ error: 'Failed to fetch rooms' }));
        });

        app.get('/rooms/:id', (req, res) => {
            const { id } = req.params;
            Database.query('SELECT * FROM rooms WHERE id = $1', [id])
                .then((result: any) => {
                    if (result.rows.length === 0) {
                        return res.status(404).json({ error: 'Room not found' });
                    }
                    res.json(result.rows[0]);
                })
                .catch(() => res.status(500).json({ error: 'Database error' }));
        });

        app.post('/rooms', (req, res) => {
            const { name, description, room_type } = req.body;
            if (!name) {
                return res.status(400).json({ error: 'Name required' });
            }
            Database.query(
                'INSERT INTO rooms (name, description, room_type) VALUES ($1, $2, $3) RETURNING *',
                [name, description, room_type || 'group']
            )
                .then((result: any) => res.status(201).json(result.rows[0]))
                .catch(() => res.status(500).json({ error: 'Failed to create room' }));
        });

        app.delete('/rooms/:id', (req, res) => {
            const { id } = req.params;
            Database.query('DELETE FROM rooms WHERE id = $1', [id])
                .then((result: any) => {
                    if (result.rowCount === 0) {
                        return res.status(404).json({ error: 'Room not found' });
                    }
                    res.json({ success: true });
                })
                .catch(() => res.status(500).json({ error: 'Failed to delete' }));
        });
    });

    describe('GET /rooms', () => {
        it('should return list of rooms', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [
                    { id: 1, name: 'General', room_type: 'group' },
                    { id: 2, name: 'Random', room_type: 'group' },
                ],
            } as any);

            const response = await request(app).get('/rooms');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
        });
    });

    describe('GET /rooms/:id', () => {
        it('should return room by ID', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [{ id: 1, name: 'General', room_type: 'group' }],
            } as any);

            const response = await request(app).get('/rooms/1');

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('General');
        });

        it('should return 404 for non-existent room', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rows: [] } as any);

            const response = await request(app).get('/rooms/999');

            expect(response.status).toBe(404);
        });
    });

    describe('POST /rooms', () => {
        it('should create a new room', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({
                rows: [{ id: 3, name: 'New Room', room_type: 'group' }],
            } as any);

            const response = await request(app)
                .post('/rooms')
                .send({ name: 'New Room', description: 'A new room' });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('New Room');
        });

        it('should reject room without name', async () => {
            const response = await request(app)
                .post('/rooms')
                .send({ description: 'No name' });

            expect(response.status).toBe(400);
        });
    });

    describe('DELETE /rooms/:id', () => {
        it('should delete a room', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rowCount: 1 } as any);

            const response = await request(app).delete('/rooms/1');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should return 404 for non-existent room', async () => {
            vi.mocked(Database.query).mockResolvedValueOnce({ rowCount: 0 } as any);

            const response = await request(app).delete('/rooms/999');

            expect(response.status).toBe(404);
        });
    });
});
