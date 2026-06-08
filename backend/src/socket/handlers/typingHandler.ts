import { AuthenticatedSocket } from '../index';
import { RedisService } from '../../config/redis';

interface TypingData {
    roomId: number;
}

class TypingHandler {
    private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();

    /**
     * Handle typing start event
     * Implements debouncing to prevent flooding the server
     */
    async handleTypingStart(
        socket: AuthenticatedSocket,
        data: TypingData
    ): Promise<void> {
        try {
            const { userId, username } = socket;
            const { roomId } = data;

            // Rate limiting: Max 1 typing event per second per user per room
            const rateLimitKey = `typing:ratelimit:${userId}:${roomId}`;
            const rateLimit = await RedisService.checkRateLimit(rateLimitKey, 1, 1000);

            if (!rateLimit.allowed) {
                // Silently ignore - user is typing too frequently
                return;
            }

            // Set typing status in Redis (auto-expires in 5 seconds)
            await RedisService.setTyping(roomId, userId);

            // Broadcast to room (via Redis Adapter)
            socket.to(`room:${roomId}`).emit('typing:start', {
                roomId,
                userId,
                username,
            });

            // Auto-stop typing after 3 seconds if no activity
            const timeoutKey = `${userId}:${roomId}`;

            // Clear existing timeout
            if (this.typingTimeouts.has(timeoutKey)) {
                clearTimeout(this.typingTimeouts.get(timeoutKey)!);
            }

            // Set new timeout
            const timeout = setTimeout(async () => {
                await this.handleTypingStop(socket, { roomId });
                this.typingTimeouts.delete(timeoutKey);
            }, 3000);

            this.typingTimeouts.set(timeoutKey, timeout);

        } catch (error) {
            console.error('Error handling typing start:', error);
        }
    }

    /**
     * Handle typing stop event
     */
    async handleTypingStop(
        socket: AuthenticatedSocket,
        data: TypingData
    ): Promise<void> {
        try {
            const { userId, username } = socket;
            const { roomId } = data;

            // Remove typing status from Redis
            await RedisService.removeTyping(roomId, userId);

            // Broadcast to room (via Redis Adapter)
            socket.to(`room:${roomId}`).emit('typing:stop', {
                roomId,
                userId,
                username,
            });

            // Clear timeout
            const timeoutKey = `${userId}:${roomId}`;
            if (this.typingTimeouts.has(timeoutKey)) {
                clearTimeout(this.typingTimeouts.get(timeoutKey)!);
                this.typingTimeouts.delete(timeoutKey);
            }

        } catch (error) {
            console.error('Error handling typing stop:', error);
        }
    }

    /**
     * Cleanup all typing timeouts for a user (called on disconnect)
     */
    cleanupUserTyping(userId: number): void {
        const keysToDelete: string[] = [];

        for (const [key] of this.typingTimeouts) {
            if (key.startsWith(`${userId}:`)) {
                clearTimeout(this.typingTimeouts.get(key)!);
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.typingTimeouts.delete(key));
    }
}

export default new TypingHandler();
