/**
 * Unit tests for custom error classes
 */

import { describe, it, expect } from 'vitest';
import {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
} from '../../src/utils/errors';

describe('Error Classes', () => {
    describe('AppError', () => {
        it('should create error with message and status code', () => {
            const error = new AppError('Something went wrong', 500);
            expect(error.message).toBe('Something went wrong');
            expect(error.statusCode).toBe(500);
            expect(error.isOperational).toBe(true);
        });

        it('should include optional code', () => {
            const error = new AppError('Bad data', 400, 'BAD_DATA');
            expect(error.code).toBe('BAD_DATA');
        });

        it('should be instance of Error', () => {
            const error = new AppError('Test');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(AppError);
        });
    });

    describe('ValidationError', () => {
        it('should have status 400', () => {
            const error = new ValidationError('Invalid input');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('VALIDATION_ERROR');
        });

        it('should include field errors', () => {
            const error = new ValidationError('Validation failed', {
                email: ['Invalid email format'],
                password: ['Too short', 'Missing uppercase'],
            });
            expect(error.errors.email).toHaveLength(1);
            expect(error.errors.password).toHaveLength(2);
        });
    });

    describe('AuthenticationError', () => {
        it('should have status 401', () => {
            const error = new AuthenticationError();
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe('AUTHENTICATION_ERROR');
            expect(error.message).toBe('Authentication required');
        });

        it('should accept custom message', () => {
            const error = new AuthenticationError('Invalid token');
            expect(error.message).toBe('Invalid token');
        });
    });

    describe('AuthorizationError', () => {
        it('should have status 403', () => {
            const error = new AuthorizationError();
            expect(error.statusCode).toBe(403);
            expect(error.code).toBe('AUTHORIZATION_ERROR');
        });
    });

    describe('NotFoundError', () => {
        it('should have status 404', () => {
            const error = new NotFoundError('User');
            expect(error.statusCode).toBe(404);
            expect(error.message).toBe('User not found');
        });
    });

    describe('ConflictError', () => {
        it('should have status 409', () => {
            const error = new ConflictError('Username already taken');
            expect(error.statusCode).toBe(409);
            expect(error.code).toBe('CONFLICT');
        });
    });

    describe('RateLimitError', () => {
        it('should have status 429', () => {
            const error = new RateLimitError(60);
            expect(error.statusCode).toBe(429);
            expect(error.retryAfter).toBe(60);
        });
    });
});
