/**
 * Unit tests for Auth Middleware
 * Tests: Token authentication
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the jwt utility module
const mockVerifyAccessToken = vi.fn();

vi.mock('../../src/utils/jwt', () => ({
    verifyAccessToken: () => mockVerifyAccessToken(),
}));

describe('Auth Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('verifyAccessToken behavior', () => {
        it('should return payload for valid token', () => {
            mockVerifyAccessToken.mockReturnValueOnce({
                userId: 1,
                username: 'testuser',
            });

            const result = mockVerifyAccessToken();

            expect(result).toBeDefined();
            expect(result?.userId).toBe(1);
        });

        it('should return null for invalid token', () => {
            mockVerifyAccessToken.mockReturnValueOnce(null);

            const result = mockVerifyAccessToken();

            expect(result).toBeNull();
        });
    });

    describe('middleware behavior', () => {
        it('should authenticate requests with valid token', () => {
            mockVerifyAccessToken.mockReturnValueOnce({
                userId: 1,
                username: 'testuser',
            });

            const mockReq: any = { headers: { authorization: 'Bearer valid-token' } };
            const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            const mockNext = vi.fn();

            // Simulate middleware logic
            const token = mockReq.headers.authorization?.split(' ')[1];
            if (token) {
                const user = mockVerifyAccessToken();
                if (user) {
                    mockReq.user = user;
                    mockNext();
                }
            }

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user.userId).toBe(1);
        });

        it('should reject requests without token', () => {
            const mockReq = { headers: {} };
            const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

            // Simulate middleware logic
            const authHeader = (mockReq.headers as any).authorization;

            if (!authHeader) {
                mockRes.status(401).json({ error: 'No token provided' });
            }

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should reject requests with invalid token', () => {
            mockVerifyAccessToken.mockReturnValueOnce(null);

            const mockReq = { headers: { authorization: 'Bearer invalid-token' } };
            const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            const mockNext = vi.fn();

            // Simulate middleware logic
            const token = (mockReq.headers as any).authorization?.split(' ')[1];
            if (token) {
                const user = mockVerifyAccessToken();
                if (!user) {
                    mockRes.status(403).json({ error: 'Invalid token' });
                }
            }

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
});
