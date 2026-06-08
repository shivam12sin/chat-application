/**
 * Token Service - Handles JWT access/refresh tokens with Redis storage
 * Implements token rotation for security
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { redisClient } from '../config/redis';
import { logInfo, logWarn } from '../config/logger';

const ACCESS_TOKEN_EXPIRY = '15m';  // Short-lived access token
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 7; // 7 days in seconds
const REFRESH_TOKEN_PREFIX = 'refresh:';
const SESSION_PREFIX = 'session:';

interface TokenPayload {
    userId: number;
    username: string;
}

interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

/**
 * Generate a cryptographically secure random token
 */
const generateSecureToken = (): string => {
    return crypto.randomBytes(48).toString('base64url');
};

/**
 * TokenService class for managing authentication tokens
 */
export class TokenService {
    private jwtSecret: string;

    constructor() {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('SECURITY: JWT_SECRET environment variable is required');
        }
        this.jwtSecret = secret;
    }

    /**
     * Generate access and refresh token pair
     */
    async generateTokenPair(userId: number, username: string): Promise<TokenPair> {
        // Generate access token (JWT)
        const accessToken = jwt.sign(
            { userId, username } as TokenPayload,
            this.jwtSecret,
            { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
        );

        // Generate refresh token (random string)
        const refreshToken = generateSecureToken();

        // Store refresh token in Redis with user info
        const tokenData = {
            userId,
            username,
            createdAt: Date.now(),
        };

        await redisClient.setex(
            `${REFRESH_TOKEN_PREFIX}${refreshToken}`,
            REFRESH_TOKEN_EXPIRY,
            JSON.stringify(tokenData)
        );

        // Add to user's session list
        await this.addToUserSessions(userId, refreshToken);

        logInfo('Token pair generated', { userId, username });

        return {
            accessToken,
            refreshToken,
            expiresIn: 15 * 60, // 15 minutes in seconds
        };
    }

    /**
     * Refresh tokens - rotates the refresh token
     */
    async refreshTokens(refreshToken: string): Promise<TokenPair | null> {
        const key = `${REFRESH_TOKEN_PREFIX}${refreshToken}`;
        const tokenDataStr = await redisClient.get(key);

        if (!tokenDataStr) {
            logWarn('Invalid refresh token attempt');
            return null;
        }

        const tokenData = JSON.parse(tokenDataStr);

        // Delete old refresh token (rotation)
        await redisClient.del(key);
        await this.removeFromUserSessions(tokenData.userId, refreshToken);

        // Generate new token pair
        return this.generateTokenPair(tokenData.userId, tokenData.username);
    }

    /**
     * Verify access token
     */
    verifyAccessToken(token: string): TokenPayload | null {
        try {
            return jwt.verify(token, this.jwtSecret) as TokenPayload;
        } catch {
            return null;
        }
    }

    /**
     * Invalidate a specific refresh token (logout)
     */
    async invalidateRefreshToken(refreshToken: string): Promise<boolean> {
        const key = `${REFRESH_TOKEN_PREFIX}${refreshToken}`;
        const tokenDataStr = await redisClient.get(key);

        if (tokenDataStr) {
            const tokenData = JSON.parse(tokenDataStr);
            await redisClient.del(key);
            await this.removeFromUserSessions(tokenData.userId, refreshToken);
            logInfo('Refresh token invalidated', { userId: tokenData.userId });
            return true;
        }

        return false;
    }

    /**
     * Invalidate all sessions for a user (logout everywhere)
     */
    async invalidateAllSessions(userId: number): Promise<number> {
        const sessionKey = `${SESSION_PREFIX}${userId}`;
        const tokens = await redisClient.smembers(sessionKey);

        let count = 0;
        for (const token of tokens) {
            await redisClient.del(`${REFRESH_TOKEN_PREFIX}${token}`);
            count++;
        }

        await redisClient.del(sessionKey);
        logInfo('All sessions invalidated', { userId, count });

        return count;
    }

    /**
     * Get active session count for a user
     */
    async getActiveSessionCount(userId: number): Promise<number> {
        const sessionKey = `${SESSION_PREFIX}${userId}`;
        return redisClient.scard(sessionKey);
    }

    /**
     * Add refresh token to user's session set
     */
    private async addToUserSessions(userId: number, refreshToken: string): Promise<void> {
        const sessionKey = `${SESSION_PREFIX}${userId}`;
        await redisClient.sadd(sessionKey, refreshToken);
        await redisClient.expire(sessionKey, REFRESH_TOKEN_EXPIRY);
    }

    /**
     * Remove refresh token from user's session set
     */
    private async removeFromUserSessions(userId: number, refreshToken: string): Promise<void> {
        const sessionKey = `${SESSION_PREFIX}${userId}`;
        await redisClient.srem(sessionKey, refreshToken);
    }
}

// Export singleton instance
export const tokenService = new TokenService();
