/**
 * Rate limiting middleware configurations
 * Uses express-rate-limit with Redis store for distributed environments
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logWarn } from '../config/logger';

/**
 * Standard API rate limiter
 * 100 requests per minute per IP
 */
export const standardLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            message: 'Too many requests, please try again later',
            code: 'RATE_LIMIT_EXCEEDED',
        },
    },
    handler: (req: Request, res: Response) => {
        logWarn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            method: req.method,
        });
        res.status(429).json({
            success: false,
            error: {
                message: 'Too many requests, please try again later',
                code: 'RATE_LIMIT_EXCEEDED',
            },
        });
    },
});

/**
 * Auth rate limiter - stricter for auth endpoints
 * 5 requests per minute per IP (prevents brute force)
 */
export const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failed attempts
    message: {
        success: false,
        error: {
            message: 'Too many login attempts, please try again later',
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
        },
    },
    handler: (req: Request, res: Response) => {
        logWarn('Auth rate limit exceeded', {
            ip: req.ip,
            path: req.path,
        });
        res.status(429).json({
            success: false,
            error: {
                message: 'Too many login attempts, please try again in 1 minute',
                code: 'AUTH_RATE_LIMIT_EXCEEDED',
            },
        });
    },
});

/**
 * Message rate limiter
 * 30 messages per minute per user
 */
export const messageLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    keyGenerator: (req: Request) => {
        // Use user ID if authenticated, otherwise IP
        const userId = (req as any).user?.userId;
        return userId ? `user:${userId}` : req.ip || 'unknown';
    },
    message: {
        success: false,
        error: {
            message: 'Message rate limit exceeded, slow down!',
            code: 'MESSAGE_RATE_LIMIT_EXCEEDED',
        },
    },
});

/**
 * Upload rate limiter
 * 10 uploads per minute
 */
export const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: {
            message: 'Upload rate limit exceeded',
            code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
        },
    },
});

/**
 * Search rate limiter
 * 20 searches per minute
 */
export const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: {
        success: false,
        error: {
            message: 'Search rate limit exceeded',
            code: 'SEARCH_RATE_LIMIT_EXCEEDED',
        },
    },
});
