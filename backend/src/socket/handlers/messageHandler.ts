import { AuthenticatedSocket } from '../index';
import { MessageRepository } from '../../repositories/MessageRepository';
import { RoomRepository } from '../../repositories/RoomRepository';
import { SearchRepository } from '../../repositories/SearchRepository';
import { BlockRepository } from '../../repositories/BlockRepository';
import { RedisService } from '../../config/redis';
import { v4 as uuidv4 } from 'uuid';

interface SendMessageData {
    roomId: number;
    content: string;
    messageType?: 'text' | 'image' | 'file' | 'encrypted';
    metadata?: any;
    tempId?: string; // For optimistic UI matching
    e2e?: boolean;   // Flag indicating E2E encrypted content
}

class MessageHandler {
    /**
     * Handle sending a new message
     * This is the core message flow:
     * 1. Validate input
     * 2. Check rate limit
     * 3. Persist to database
     * 4. Emit to room (Redis will broadcast to other servers)
     * 5. Send acknowledgment to sender
     * 6. Queue for offline users
     */
    async handleSendMessage(
        socket: AuthenticatedSocket,
        data: SendMessageData,
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { userId, username } = socket;
            const { roomId, content, messageType = 'text', metadata, tempId, e2e = false } = data;

            // Validation
            if (!content || content.trim().length === 0) {
                callback?.({ success: false, error: 'Message content is required' });
                return;
            }

            if (content.length > 10000) {
                callback?.({ success: false, error: 'Message too long (max 10,000 characters)' });
                return;
            }

            // Rate limiting: Max 10 messages per second per user
            const rateLimit = await RedisService.checkRateLimit(
                `ratelimit:message:${userId}`,
                10,
                1000
            );

            if (!rateLimit.allowed) {
                callback?.({
                    success: false,
                    error: 'Rate limit exceeded. Please slow down.',
                    retryAfter: 1000
                });
                return;
            }

            // Verify user is member of room
            const isMember = await RoomRepository.isUserMemberOfRoom(userId, roomId);
            if (!isMember) {
                callback?.({ success: false, error: 'You are not a member of this room' });
                return;
            }

            // Block check for DM rooms: check if either user blocked the other
            const room = await RoomRepository.getRoomById(roomId);
            if (room?.room_type === 'direct') {
                const members = await RoomRepository.getRoomMembers(roomId);
                const otherUser = members.find(m => m.user_id !== userId);
                if (otherUser) {
                    const isBlocked = await BlockRepository.isEitherBlocked(userId, otherUser.user_id);
                    if (isBlocked) {
                        callback?.({ success: false, error: 'Cannot send message to this user' });
                        return;
                    }
                }
            }

            // Create message in database
            const messageId = uuidv4();
            const message = await MessageRepository.createMessage({
                id: messageId,
                roomId,
                senderId: userId,
                content,
                messageType,
                metadata: {
                    ...metadata,
                    e2e, // Store E2E flag in metadata
                },
            });

            // Get room members
            const members = await RoomRepository.getRoomMembers(roomId);
            const recipientIds = members
                .map(m => m.user_id)
                .filter(id => id !== userId);

            // Create message receipts for each recipient
            await MessageRepository.createMessageReceipts(messageId, recipientIds);

            // Cache message in Redis for fast retrieval
            await RedisService.cacheMessage(roomId, message);

            // Index message to Elasticsearch for search (non-blocking)
            // NOTE: E2E encrypted messages are not indexed for search (privacy)
            if (!e2e) {
                SearchRepository.indexMessage({
                    id: messageId,
                    room_id: roomId,
                    sender_id: userId,
                    sender_username: username,
                    content,
                    message_type: messageType,
                    created_at: message.created_at
                }).catch(err => console.warn('ES index skipped:', err.message));
            }

            // ============================================
            // CRITICAL: Emit to room
            // ============================================
            // This uses Redis Adapter to broadcast across all server instances
            // If recipient is on a different server, Redis Pub/Sub handles it
            socket.to(`room:${roomId}`).emit('message:new', {
                ...message,
                e2e, // Include E2E flag for clients
                sender: {
                    id: userId,
                    username: username,
                },
                tempId, // Send back tempId so other clients can deduplicate if needed
            });

            // Stop typing indicator for this user
            await RedisService.removeTyping(roomId, userId);
            socket.to(`room:${roomId}`).emit('typing:stop', {
                roomId,
                userId,
                username: username,
            });

            // Send acknowledgment to sender (optimistic UI confirmation)
            callback?.({
                success: true,
                message: {
                    ...message,
                    e2e, // Include E2E flag
                    tempId, // Match with client's temporary ID
                },
            });

            // Check for offline users and queue messages
            await this.queueForOfflineUsers(messageId, recipientIds);

            console.log(`Message sent: ${messageId} in room ${roomId} by user ${userId}`);

        } catch (error) {
            console.error('Error handling send message:', error);
            callback?.({
                success: false,
                error: 'Failed to send message. Please try again.'
            });
        }
    }

    /**
     * Handle message delivered status
     * User has received the message on their device
     */
    async handleMessageDelivered(
        socket: AuthenticatedSocket,
        data: { messageId: string; roomId: number }
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { messageId, roomId } = data;

            // Update delivery status in database
            await MessageRepository.markAsDelivered(messageId, userId);

            // Get message details to notify sender
            const message = await MessageRepository.getMessageById(messageId);
            if (!message) return;

            // Notify sender about delivery (via Redis to any server)
            socket.to(`room:${roomId}`).emit('message:status', {
                messageId,
                userId,
                status: 'delivered',
                deliveredAt: new Date(),
            });

            console.log(`Message ${messageId} delivered to user ${userId}`);

        } catch (error) {
            console.error('Error handling message delivered:', error);
        }
    }

    /**
     * Handle message read status
     * User has actually read/viewed the message
     */
    async handleMessageRead(
        socket: AuthenticatedSocket,
        data: { messageId: string; roomId: number }
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { messageId, roomId } = data;

            // Update read status in database
            await MessageRepository.markAsRead(messageId, userId);

            // Notify sender about read status (via Redis to any server)
            socket.to(`room:${roomId}`).emit('message:status', {
                messageId,
                userId,
                status: 'read',
                readAt: new Date(),
            });

            console.log(`Message ${messageId} read by user ${userId}`);

        } catch (error) {
            console.error('Error handling message read:', error);
        }
    }

    /**
     * Queue messages for offline users
     * Messages will be delivered when they come online
     */
    private async queueForOfflineUsers(
        messageId: string,
        recipientIds: number[]
    ): Promise<void> {
        try {
            for (const recipientId of recipientIds) {
                const isOnline = await RedisService.isUserOnline(recipientId);
                if (!isOnline) {
                    // Message is already in DB with delivered_at = NULL
                    // It will be fetched when user connects
                    console.log(`Message ${messageId} queued for offline user ${recipientId}`);
                }
            }
        } catch (error) {
            console.error('Error queuing for offline users:', error);
        }
    }

    /**
     * Handle message delete request via socket
     * Broadcasts deletion to all room members
     */
    async handleDeleteMessage(
        socket: AuthenticatedSocket,
        data: { messageId: string; roomId: number; mode: 'me' | 'everyone' },
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { messageId, roomId, mode } = data;

            if (mode === 'everyone') {
                // Broadcast to room that message was deleted
                socket.to(`room:${roomId}`).emit('message:deleted', {
                    messageId,
                    roomId,
                    deletedBy: userId,
                    deletedAt: new Date()
                });
            }

            callback?.({ success: true });

        } catch (error) {
            console.error('Error handling delete message:', error);
            callback?.({ success: false, error: 'Failed to delete message' });
        }
    }

    /**
     * Handle undo delete via socket
     * Broadcasts restoration to room
     */
    async handleUndoDelete(
        socket: AuthenticatedSocket,
        data: { messageId: string; roomId: number },
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { messageId, roomId } = data;

            // Broadcast to room that message was restored
            socket.to(`room:${roomId}`).emit('message:restored', {
                messageId,
                roomId,
                restoredAt: new Date()
            });

            callback?.({ success: true });

        } catch (error) {
            console.error('Error handling undo delete:', error);
            callback?.({ success: false, error: 'Failed to undo delete' });
        }
    }

    /**
     * Handle pinning a message in a space
     */
    async handlePinMessage(
        socket: AuthenticatedSocket,
        data: { messageId: string; roomId: number },
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { messageId, roomId } = data;

            // Verify user is member
            const isMember = await RoomRepository.isUserMemberOfRoom(userId, roomId);
            if (!isMember) {
                callback?.({ success: false, error: 'Not authorized' });
                return;
            }

            await MessageRepository.pinMessage(messageId);

            // Broadcast to room
            socket.to(`room:${roomId}`).emit('message:pinned', { messageId, roomId });
            socket.emit('message:pinned', { messageId, roomId });

            callback?.({ success: true });
            console.log(`Message ${messageId} pinned in room ${roomId}`);

        } catch (error) {
            console.error('Error pinning message:', error);
            callback?.({ success: false, error: 'Failed to pin message' });
        }
    }

    /**
     * Handle unpinning a message
     */
    async handleUnpinMessage(
        socket: AuthenticatedSocket,
        data: { messageId: string; roomId: number },
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { messageId, roomId } = data;

            const isMember = await RoomRepository.isUserMemberOfRoom(userId, roomId);
            if (!isMember) {
                callback?.({ success: false, error: 'Not authorized' });
                return;
            }

            await MessageRepository.unpinMessage(messageId);

            socket.to(`room:${roomId}`).emit('message:unpinned', { messageId, roomId });
            socket.emit('message:unpinned', { messageId, roomId });

            callback?.({ success: true });
            console.log(`Message ${messageId} unpinned in room ${roomId}`);

        } catch (error) {
            console.error('Error unpinning message:', error);
            callback?.({ success: false, error: 'Failed to unpin message' });
        }
    }

    /**
     * Get pinned messages for a room
     */
    async handleGetPinnedMessages(
        socket: AuthenticatedSocket,
        data: { roomId: number },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { roomId } = data;

            const isMember = await RoomRepository.isUserMemberOfRoom(userId, roomId);
            if (!isMember) {
                callback({ error: 'Not authorized' });
                return;
            }

            const pinnedMessages = await MessageRepository.getPinnedMessages(roomId);
            callback({ messages: pinnedMessages });

        } catch (error) {
            console.error('Error getting pinned messages:', error);
            callback({ error: 'Failed to get pinned messages' });
        }
    }
}

export default new MessageHandler();

