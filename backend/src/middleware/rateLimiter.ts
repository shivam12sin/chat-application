import { Socket } from 'socket.io';
import { RedisService } from '../config/redis';

/**
 * Connection rate limiter middleware for Socket.io
 * Prevents thundering herd by limiting new connections per second
 * 
 * This is critical for handling scenarios where thousands of users
 * reconnect simultaneously (e.g., after server restart)
 */
export const rateLimitMiddleware = async (
    socket: Socket,
    next: (err?: Error) => void
): Promise<void> => {
    try {
        const serverInstanceId = process.env.SERVER_INSTANCE_ID || 'default';
        const ip = socket.handshake.address;

        // Rate limit key per server instance
        const rateLimitKey = `connection:ratelimit:${serverInstanceId}`;

        // Max connections per second (configurable via env)
        const maxConnectionsPerSecond = parseInt(
            process.env.CONNECTION_RATE_LIMIT_MAX || '100'
        );

        // Check rate limit using sliding window
        const rateLimit = await RedisService.checkRateLimit(
            rateLimitKey,
            maxConnectionsPerSecond,
            1000 // 1 second window
        );

        if (!rateLimit.allowed) {
            // Calculate retry delay with exponential backoff
            const retryAfter = Math.min(1000 + Math.random() * 2000, 5000);

            console.warn(
                `Connection rate limit exceeded for ${ip}. Retry after ${retryAfter}ms`
            );

            return next(new Error(`Too many connections. Retry after ${retryAfter}ms`));
        }

        // Also check per-IP rate limit to prevent single IP flooding
        const ipRateLimitKey = `connection:ratelimit:ip:${ip}`;
        const ipRateLimit = await RedisService.checkRateLimit(
            ipRateLimitKey,
            process.env.NODE_ENV === 'development' ? 1000 : 20, // Max connections per IP per second
            1000
        );

        if (!ipRateLimit.allowed) {
            console.warn(`IP rate limit exceeded for ${ip}`);
            return next(new Error('Too many connection attempts from your IP'));
        }

        next();

    } catch (error) {
        console.error('Rate limit middleware error:', error);
        // Don't block connections on rate limiter errors
        next();
    }
};
