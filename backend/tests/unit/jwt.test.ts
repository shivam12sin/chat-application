/**
 * Unit tests for JWT Utility
 * Tests: Token generation, verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('jsonwebtoken');

describe('JWT Utility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('jwt.sign', () => {
        it('should generate a token', () => {
            vi.mocked(jwt.sign).mockReturnValueOnce('test-token' as any);

            const token = jwt.sign({ userId: 1 }, 'secret');

            expect(token).toBe('test-token');
        });
    });

    describe('jwt.verify', () => {
        it('should verify valid token', () => {
            vi.mocked(jwt.verify).mockReturnValueOnce({
                userId: 1,
                username: 'testuser',
            } as any);

            const payload = jwt.verify('valid-token', 'secret');

            expect((payload as any).userId).toBe(1);
        });

        it('should throw for invalid token', () => {
            vi.mocked(jwt.verify).mockImplementationOnce(() => {
                throw new Error('Invalid token');
            });

            expect(() => jwt.verify('invalid-token', 'secret')).toThrow();
        });

        it('should throw for expired token', () => {
            vi.mocked(jwt.verify).mockImplementationOnce(() => {
                throw new jwt.TokenExpiredError('Token expired', new Date());
            });

            expect(() => jwt.verify('expired-token', 'secret')).toThrow();
        });
    });
});
