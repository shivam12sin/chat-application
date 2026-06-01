/**
 * Integration tests for error handling middleware
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import { errorHandler, requestIdMiddleware, notFoundHandler } from '../../src/middleware/errorHandler';
import { AppError, ValidationError, NotFoundError } from '../../src/utils/errors';

// Mock logger
vi.mock('../../src/config/logger', () => ({
    logError: vi.fn(),
    logInfo: vi.fn(),
}));

describe('Error Handling Middleware', () => {
    let app: express.Express;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(requestIdMiddleware);

        // Test routes that throw different errors
        app.get('/test/app-error', (_req: Request, _res: Response, next: NextFunction) => {
            next(new AppError('Test app error', 400, 'TEST_ERROR'));
        });

        app.get('/test/validation-error', (_req: Request, _res: Response, next: NextFunction) => {
            next(new ValidationError('Validation failed', { email: ['Invalid email'] }));
        });

        app.get('/test/not-found', (_req: Request, _res: Response, next: NextFunction) => {
            next(new NotFoundError('User'));
        });

        app.get('/test/zod-error', (_req: Request, _res: Response, next: NextFunction) => {
            const schema = z.object({ name: z.string() });
            try {
                schema.parse({ name: 123 });
            } catch (e) {
                next(e);
            }
        });

        app.get('/test/unknown-error', (_req: Request, _res: Response, next: NextFunction) => {
            next(new Error('Unknown error'));
        });

        // 404 handler and error handler
        app.use(notFoundHandler);
        app.use(errorHandler);
    });

    describe('requestIdMiddleware', () => {
        it('should add requestId to responses', async () => {
            const response = await request(app).get('/test/app-error');
            expect(response.body.requestId).toBeDefined();
        });
    });

    describe('AppError handling', () => {
        it('should return correct status and message', async () => {
            const response = await request(app).get('/test/app-error');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toBe('Test app error');
            expect(response.body.error.code).toBe('TEST_ERROR');
        });
    });

    describe('ValidationError handling', () => {
        it('should include field errors', async () => {
            const response = await request(app).get('/test/validation-error');

            expect(response.status).toBe(400);
            expect(response.body.error.errors.email).toContain('Invalid email');
        });
    });

    describe('NotFoundError handling', () => {
        it('should return 404', async () => {
            const response = await request(app).get('/test/not-found');

            expect(response.status).toBe(404);
            expect(response.body.error.message).toBe('User not found');
        });
    });

    describe('ZodError handling', () => {
        it('should format Zod validation errors', async () => {
            const response = await request(app).get('/test/zod-error');

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.errors).toBeDefined();
        });
    });

    describe('Unknown error handling', () => {
        it('should return 500 for unknown errors', async () => {
            const response = await request(app).get('/test/unknown-error');

            expect(response.status).toBe(500);
            expect(response.body.error.code).toBe('INTERNAL_ERROR');
        });
    });

    describe('notFoundHandler', () => {
        it('should return 404 for undefined routes', async () => {
            const response = await request(app).get('/nonexistent-route');

            expect(response.status).toBe(404);
            expect(response.body.error.code).toBe('NOT_FOUND');
        });
    });
});
