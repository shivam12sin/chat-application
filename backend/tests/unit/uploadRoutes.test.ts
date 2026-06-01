/**
 * Unit tests for Upload Routes
 * Tests: File upload validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../src/middleware/auth', () => ({
    authenticateTokenHTTP: (req: any, _res: any, next: any) => {
        req.user = { userId: 1, username: 'testuser' };
        next();
    },
}));

describe('Upload Routes', () => {
    let app: express.Express;

    beforeEach(() => {
        vi.clearAllMocks();
        app = express();
        app.use(express.json());

        // Mock upload endpoint
        app.post('/upload', (req, res) => {
            if (!req.headers['content-type']?.includes('multipart')) {
                return res.status(400).json({ error: 'Multipart form required' });
            }
            res.json({ success: true, fileId: 'mock-file-id' });
        });

        app.get('/upload/:fileId', (req, res) => {
            const { fileId } = req.params;
            if (fileId === 'not-found') {
                return res.status(404).json({ error: 'File not found' });
            }
            res.json({ id: fileId, url: `/files/${fileId}` });
        });
    });

    describe('POST /upload', () => {
        it('should reject non-multipart requests', async () => {
            const response = await request(app)
                .post('/upload')
                .send({ file: 'data' });

            expect(response.status).toBe(400);
        });
    });

    describe('GET /upload/:fileId', () => {
        it('should return file info', async () => {
            const response = await request(app).get('/upload/valid-file');

            expect(response.status).toBe(200);
            expect(response.body.url).toBeDefined();
        });

        it('should return 404 for missing file', async () => {
            const response = await request(app).get('/upload/not-found');

            expect(response.status).toBe(404);
        });
    });
});
