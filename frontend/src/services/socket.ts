import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

class SocketService {
    private socket: Socket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;

    /**
     * Connect to WebSocket server
     * Implements exponential backoff with jittered delay (thundering herd protection)
     */
    connect(token: string): Socket {
        if (this.socket?.connected) {
            return this.socket;
        }

        this.socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000, // Start with 1s
            reconnectionDelayMax: 5000, // Max 5s
            // Add random jitter to prevent thundering herd
            randomizationFactor: 0.5, // Adds 0-50% random delay
        });

        // Connection event handlers
        this.socket.on('connect', () => {
            console.log('WebSocket connected:', this.socket?.id);
            this.reconnectAttempts = 0;
        });

        this.socket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error.message);
            this.reconnectAttempts++;

            // Exponential backoff with jitter
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                const jitter = Math.random() * 5000; // 0-5s random jitter
                const delay = baseDelay + jitter;

                console.log(`Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);
            }
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`Reconnected after ${attemptNumber} attempts`);
        });

        this.socket.on('reconnect_failed', () => {
            console.error('Failed to reconnect after maximum attempts');
        });

        return this.socket;
    }

    /**
     * Disconnect from server
     */
    disconnect(): void {
        this.socket?.disconnect();
        this.socket = null;
    }

    /**
     * Get socket instance
     */
    getSocket(): Socket | null {
        return this.socket;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.socket?.connected || false;
    }

    /**
     * Join a room
     */
    joinRoom(roomId: number): void {
        this.socket?.emit('room:join', { roomId });
    }

    /**
     * Leave a room
     */
    leaveRoom(roomId: number): void {
        this.socket?.emit('room:leave', { roomId });
    }

    /**
     * Send a message (with optimistic UI callback)
     */
    sendMessage(
        roomId: number,
        content: string,
        tempId: string,
        callback: (response: any) => void,
        options?: {
            messageType?: 'text' | 'image' | 'file' | 'encrypted';
            e2e?: boolean;
            metadata?: Record<string, any>;
        }
    ): void {
        this.socket?.emit(
            'message:send',
            {
                roomId,
                content,
                messageType: options?.messageType || 'text',
                tempId,
                e2e: options?.e2e || false,
                metadata: options?.metadata,
            },
            callback
        );
    }

    /**
     * Send an encrypted message
     * This is a convenience wrapper that sets the E2E flags
     */
    sendEncryptedMessage(
        roomId: number,
        encryptedContent: string,
        tempId: string,
        callback: (response: any) => void,
        metadata?: Record<string, any>
    ): void {
        this.sendMessage(roomId, encryptedContent, tempId, callback, {
            messageType: 'encrypted',
            e2e: true,
            metadata,
        });
    }

    /**
     * Mark message as delivered
     */
    markMessageDelivered(messageId: string, roomId: number): void {
        this.socket?.emit('message:delivered', { messageId, roomId });
    }

    /**
     * Mark message as read
     */
    markMessageRead(messageId: string, roomId: number): void {
        this.socket?.emit('message:read', { messageId, roomId });
    }

    /**
     * Start typing indicator
     */
    startTyping(roomId: number): void {
        this.socket?.emit('typing:start', { roomId });
    }

    /**
     * Stop typing indicator
     */
    stopTyping(roomId: number): void {
        this.socket?.emit('typing:stop', { roomId });
    }

    /**
     * Create a new Shared Space
     */
    createSpace(
        data: { name: string; description: string; tone: string; initialMembers: number[] },
        callback: (response: any) => void
    ): void {
        this.socket?.emit('space:create', data, callback);
    }

    /**
     * Invite a user to a space
     */
    inviteToSpace(
        spaceId: number,
        userId: number,
        callback: (response: any) => void
    ): void {
        this.socket?.emit('space:invite', { spaceId, userId }, callback);
    }

    /**
     * Leave a space
     */
    leaveSpace(spaceId: number, callback?: (response: any) => void): void {
        this.socket?.emit('space:leave', { spaceId }, callback);
    }

    /**
     * Update space settings
     */
    updateSpace(
        spaceId: number,
        updates: { name?: string; description?: string; tone?: string; settings?: any },
        callback: (response: any) => void
    ): void {
        this.socket?.emit('space:update', { spaceId, ...updates }, callback);
    }

    /**
     * Get space members
     */
    getSpaceMembers(spaceId: number, callback: (response: any) => void): void {
        this.socket?.emit('space:members', { spaceId }, callback);
    }

    /**
     * Set your alias/tag in a space (optional, like WhatsApp member tags)
     */
    setMemberAlias(
        spaceId: number,
        alias: string | null,
        callback: (response: { success?: boolean; alias?: string | null; error?: string }) => void
    ): void {
        this.socket?.emit('space:set_alias', { spaceId, alias }, callback);
    }

    /**
     * Toggle reaction on a message (add if not exists, remove if exists)
     */
    toggleReaction(
        messageId: string,
        roomId: number,
        emoji: string,
        callback: (response: { success: boolean; added?: boolean; reactions?: any[]; error?: string }) => void
    ): void {
        this.socket?.emit('reaction:toggle', { messageId, roomId, emoji }, callback);
    }

    /**
     * Pin a message
     */
    pinMessage(messageId: string, roomId: number, callback: (response: any) => void): void {
        this.socket?.emit('message:pin', { messageId, roomId }, callback);
    }

    /**
     * Unpin a message
     */
    unpinMessage(messageId: string, roomId: number, callback: (response: any) => void): void {
        this.socket?.emit('message:unpin', { messageId, roomId }, callback);
    }

    /**
     * Get pinned messages for a room
     */
    getPinnedMessages(roomId: number, callback: (response: any) => void): void {
        this.socket?.emit('message:get_pinned', { roomId }, callback);
    }

    // ============================================
    // CONSTELLATION METHODS (Message Collections)
    // ============================================

    /**
     * Create a new constellation
     */
    createConstellation(
        name: string,
        description: string | undefined,
        callback: (response: { success?: boolean; constellation?: any; error?: string }) => void
    ): void {
        this.socket?.emit('constellation:create', { name, description }, callback);
    }

    /**
     * Get all user's constellations
     */
    getConstellations(
        callback: (response: { constellations?: any[]; error?: string }) => void
    ): void {
        this.socket?.emit('constellation:list', {}, callback);
    }

    /**
     * Update a constellation
     */
    updateConstellation(
        constellationId: number,
        updates: { name?: string; description?: string },
        callback: (response: { success?: boolean; constellation?: any; error?: string }) => void
    ): void {
        this.socket?.emit('constellation:update', { constellationId, ...updates }, callback);
    }

    /**
     * Delete a constellation
     */
    deleteConstellation(
        constellationId: number,
        callback: (response: { success?: boolean; error?: string }) => void
    ): void {
        this.socket?.emit('constellation:delete', { constellationId }, callback);
    }

    /**
     * Add a message to a constellation
     */
    addToConstellation(
        constellationId: number,
        messageId: string,
        roomId: number,
        callback: (response: { success?: boolean; entry?: any; error?: string }) => void
    ): void {
        this.socket?.emit('constellation:add_message', { constellationId, messageId, roomId }, callback);
    }

    /**
     * Remove a message from a constellation
     */
    removeFromConstellation(
        constellationId: number,
        messageId: string,
        callback: (response: { success?: boolean; error?: string }) => void
    ): void {
        this.socket?.emit('constellation:remove_message', { constellationId, messageId }, callback);
    }

    /**
     * Get all messages in a constellation
     */
    getConstellationMessages(
        constellationId: number,
        callback: (response: { messages?: any[]; error?: string }) => void
    ): void {
        this.socket?.emit('constellation:get_messages', { constellationId }, callback);
    }

    /**
     * Get which constellations contain a message
     */
    getConstellationsForMessage(
        messageId: string,
        callback: (response: { constellationIds?: number[]; error?: string }) => void
    ): void {
        this.socket?.emit('constellation:for_message', { messageId }, callback);
    }

    // ============================================
    // CHAT LOCK METHODS
    // ============================================

    /**
     * Lock or unlock a chat
     */
    lockChat(
        roomId: number,
        locked: boolean,
        callback: (response: { success?: boolean; error?: string }) => void
    ): void {
        this.socket?.emit('room:lock', { roomId, locked }, callback);
    }

    /**
     * Get all locked room IDs for current user
     */
    getLockedRooms(
        callback: (response: { lockedRoomIds?: number[]; error?: string }) => void
    ): void {
        this.socket?.emit('room:get_locked', {}, callback);
    }

    /**
     * Listen to events
     */
    on(event: string, callback: (...args: any[]) => void): void {
        this.socket?.on(event, callback);
    }

    /**
     * Remove event listener
     */
    off(event: string, callback?: (...args: any[]) => void): void {
        this.socket?.off(event, callback);
    }
    /**
     * Emit a custom event
     */
    emit(event: string, data: any, callback?: (response: any) => void): void {
        this.socket?.emit(event, data, callback);
    }

    // ============================================
    // E2E ENCRYPTION METHODS
    // ============================================

    /**
     * Distribute sender key to room members (group E2E)
     */
    distributeSenderKey(
        roomId: number,
        distribution: string,
        callback?: (response: { success: boolean; error?: string }) => void
    ): void {
        this.socket?.emit('e2e:distribute_sender_key', { roomId, distribution }, callback);
    }

    /**
     * Notify room about key rotation (member left or scheduled rotation)
     */
    notifyKeyRotation(
        roomId: number,
        reason: 'member_left' | 'scheduled' | 'manual',
        newKeyId?: number,
        callback?: (response: { success: boolean; error?: string }) => void
    ): void {
        this.socket?.emit('e2e:key_rotation', { roomId, reason, newKeyId }, callback);
    }

    /**
     * Request sender keys for a room (when joining a group)
     */
    requestSenderKeys(
        roomId: number,
        callback: (response: {
            success: boolean;
            senderKeys?: Array<{
                senderUserId: number;
                distributionKeyPublic: string;
                distributionKeyId: number;
                chainIteration: number;
            }>;
            error?: string
        }) => void
    ): void {
        this.socket?.emit('e2e:request_sender_keys', { roomId }, callback);
    }

    /**
     * Acknowledge receipt of a sender key
     */
    acknowledgeSenderKey(
        roomId: number,
        senderUserId: number,
        keyId: number,
        callback?: (response: { success: boolean }) => void
    ): void {
        this.socket?.emit('e2e:sender_key_ack', { roomId, senderUserId, keyId }, callback);
    }

    /**
     * Establish E2E session with another user (DM)
     */
    establishE2ESession(
        targetUserId: number,
        preKeyBundle?: string,
        callback?: (response: { success: boolean; e2eEnabled?: boolean; error?: string }) => void
    ): void {
        this.socket?.emit('e2e:session_establish', { targetUserId, preKeyBundle }, callback);
    }

    /**
     * Notify about key change (security alert)
     */
    notifyKeyChange(
        userId: number,
        keyType: 'identity' | 'signed_prekey',
        callback?: (response: { success: boolean }) => void
    ): void {
        this.socket?.emit('e2e:key_change', { userId, keyType }, callback);
    }

    /**
     * Subscribe to E2E events
     */
    setupE2EListeners(handlers: {
        onSenderKey?: (data: { roomId: number; senderId: number; senderUsername: string; distribution: string }) => void;
        onKeyRotated?: (data: { roomId: number; userId: number; username: string; reason: string; newKeyId?: number }) => void;
        onSenderKeyRequest?: (data: { roomId: number; requesterId: number; requesterUsername: string }) => void;
        onSenderKeyAck?: (data: { roomId: number; receiverId: number; keyId: number }) => void;
        onSessionRequest?: (data: { fromUserId: number; preKeyBundle?: string }) => void;
    }): void {
        if (handlers.onSenderKey) {
            this.socket?.on('e2e:sender_key', handlers.onSenderKey);
        }
        if (handlers.onKeyRotated) {
            this.socket?.on('e2e:key_rotated', handlers.onKeyRotated);
        }
        if (handlers.onSenderKeyRequest) {
            this.socket?.on('e2e:sender_key_request', handlers.onSenderKeyRequest);
        }
        if (handlers.onSenderKeyAck) {
            this.socket?.on('e2e:sender_key_ack', handlers.onSenderKeyAck);
        }
        if (handlers.onSessionRequest) {
            this.socket?.on('e2e:session_request', handlers.onSessionRequest);
        }
    }

    /**
     * Remove E2E event listeners
     */
    removeE2EListeners(): void {
        this.socket?.off('e2e:sender_key');
        this.socket?.off('e2e:key_rotated');
        this.socket?.off('e2e:sender_key_request');
        this.socket?.off('e2e:sender_key_ack');
        this.socket?.off('e2e:session_request');
    }
}

export default new SocketService();
