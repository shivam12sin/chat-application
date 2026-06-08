import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),

    // Connection settings
    retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },

    // Reconnection
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    enableOfflineQueue: true,

    // Keep alive
    keepAlive: 30000,

    // Timeouts
    connectTimeout: 10000,
    commandTimeout: 5000,
};

// Main Redis client for general operations (caching, session management)
export const redisClient = new Redis(redisConfig);

// Pub client for Socket.io Redis Adapter
export const redisPubClient = new Redis(redisConfig);

// Sub client for Socket.io Redis Adapter
export const redisSubClient = new Redis(redisConfig);

// Error handling
redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('✓ Redis Client connected');
});

redisPubClient.on('error', (err) => {
    console.error('Redis Pub Client Error:', err);
});

redisPubClient.on('connect', () => {
    console.log('✓ Redis Pub Client connected (Socket.io Adapter)');
});

redisSubClient.on('error', (err) => {
    console.error('Redis Sub Client Error:', err);
});

redisSubClient.on('connect', () => {
    console.log('✓ Redis Sub Client connected (Socket.io Adapter)');
});

// Redis helper functions for chat application

export class RedisService {
    // User presence management
    static async setUserOnline(userId: number, socketId: string): Promise<void> {
        await redisClient.hset(`user:${userId}:sessions`, socketId, Date.now());
        await redisClient.sadd('users:online', userId);
    }

    static async setUserOffline(userId: number, socketId: string): Promise<void> {
        await redisClient.hdel(`user:${userId}:sessions`, socketId);
        const sessions = await redisClient.hlen(`user:${userId}:sessions`);
        if (sessions === 0) {
            await redisClient.srem('users:online', userId);
        }
    }

    static async isUserOnline(userId: number): Promise<boolean> {
        const result = await redisClient.sismember('users:online', userId);
        return result === 1;
    }

    static async getUserSocketIds(userId: number): Promise<string[]> {
        const sessions = await redisClient.hkeys(`user:${userId}:sessions`);
        return sessions;
    }

    // Typing indicator cache (ephemeral, 5 second TTL)
    static async setTyping(roomId: number, userId: number): Promise<void> {
        const key = `room:${roomId}:typing`;
        await redisClient.sadd(key, userId);
        await redisClient.expire(key, 5); // Auto-expire after 5 seconds
    }

    static async removeTyping(roomId: number, userId: number): Promise<void> {
        await redisClient.srem(`room:${roomId}:typing`, userId);
    }

    static async getTypingUsers(roomId: number): Promise<string[]> {
        return await redisClient.smembers(`room:${roomId}:typing`);
    }

    // Rate limiting (using Redis for distributed rate limiting)
    static async checkRateLimit(
        key: string,
        limit: number,
        windowMs: number
    ): Promise<{ allowed: boolean; remaining: number }> {
        const now = Date.now();
        const windowStart = now - windowMs;

        const multi = redisClient.multi();
        multi.zremrangebyscore(key, 0, windowStart); // Remove old entries
        multi.zadd(key, now, `${now}`);
        multi.zcard(key);
        multi.expire(key, Math.ceil(windowMs / 1000));

        const results = await multi.exec();
        const count = results?.[2]?.[1] as number || 0;

        return {
            allowed: count <= limit,
            remaining: Math.max(0, limit - count),
        };
    }

    // Message cache (cache recent messages for fast retrieval)
    static async cacheMessage(roomId: number, messageData: any): Promise<void> {
        const key = `room:${roomId}:messages:cache`;
        await redisClient.zadd(key, Date.now(), JSON.stringify(messageData));
        await redisClient.zremrangebyrank(key, 0, -51); // Keep only last 50
        await redisClient.expire(key, 3600); // 1 hour TTL
    }

    static async getCachedMessages(roomId: number, limit: number = 50): Promise<any[]> {
        const key = `room:${roomId}:messages:cache`;
        const messages = await redisClient.zrange(key, -limit, -1);
        return messages.map(msg => JSON.parse(msg));
    }

    // Health check
    static async healthCheck(): Promise<boolean> {
        try {
            const pong = await redisClient.ping();
            return pong === 'PONG';
        } catch (error) {
            return false;
        }
    }
}

export default redisClient;
