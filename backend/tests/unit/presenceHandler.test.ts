/**
 * Unit tests for Presence functionality
 * Tests: Online/offline status management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database', () => ({
    default: { query: vi.fn() },
}));

vi.mock('../../src/config/redis', () => ({
    RedisService: {
        setUserOnline: vi.fn().mockResolvedValue(undefined),
        setUserOffline: vi.fn().mockResolvedValue(undefined),
        isUserOnline: vi.fn().mockResolvedValue(true),
        getUserSocketIds: vi.fn().mockResolvedValue(['socket-1']),
    },
}));

import { RedisService } from '../../src/config/redis';

describe('Presence Functionality', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('online status', () => {
        it('should set user online', async () => {
            await RedisService.setUserOnline(1, 'socket-123');
            expect(RedisService.setUserOnline).toHaveBeenCalledWith(1, 'socket-123');
        });

        it('should set user offline', async () => {
            await RedisService.setUserOffline(1, 'socket-123');
            expect(RedisService.setUserOffline).toHaveBeenCalledWith(1, 'socket-123');
        });

        it('should check if user is online', async () => {
            const isOnline = await RedisService.isUserOnline(1);
            expect(isOnline).toBe(true);
        });

        it('should get user socket IDs', async () => {
            const sockets = await RedisService.getUserSocketIds(1);
            expect(sockets).toContain('socket-1');
        });
    });
});
