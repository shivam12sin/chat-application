import Database from '../config/database';

interface Message {
    id: string;
    room_id: number;
    sender_id: number;
    content: string;
    message_type: string;
    created_at: Date;
    metadata?: any;
}



export class MessageRepository {
    /**
     * Create a new message
     */
    static async createMessage(data: {
        id?: string;
        roomId: number;
        senderId: number;
        content: string;
        messageType?: string;
        metadata?: any;
    }): Promise<any> {
        const { id, roomId, senderId, content, messageType = 'text', metadata } = data;

        if (id) {
            const result = await Database.query(
                `INSERT INTO messages (id, room_id, sender_id, content, message_type, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
                [id, roomId, senderId, content, messageType, metadata]
            );
            return result.rows[0];
        } else {
            const result = await Database.query(
                `INSERT INTO messages (room_id, sender_id, content, message_type, metadata)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
                [roomId, senderId, content, messageType, metadata]
            );
            return result.rows[0];
        }
    }

    /**
     * Get messages by room with cursor-based pagination
     * cursor = messageId to fetch messages older than this ID
     */
    static async getMessagesByRoom(
        roomId: number,
        limit: number = 50,
        cursor?: string
    ): Promise<{ messages: Message[]; nextCursor: string | null }> {
        let query: string;
        let params: any[];

        if (cursor) {
            // Get message timestamp for cursor
            const cursorResult = await Database.query(
                `SELECT created_at FROM messages WHERE id = $1`,
                [cursor]
            );

            if (cursorResult.rows.length === 0) {
                throw new Error('Invalid cursor');
            }

            const cursorTimestamp = cursorResult.rows[0].created_at;

            // Fetch messages older than cursor
            query = `
        SELECT m.*, u.username as sender_username, u.avatar_url as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.room_id = $1 
          AND m.deleted_at IS NULL
          AND m.created_at < $2
        ORDER BY m.created_at DESC
        LIMIT $3
      `;
            params = [roomId, cursorTimestamp, limit + 1]; // +1 to check if there are more

        } else {
            // Fetch latest messages
            query = `
        SELECT m.*, u.username as sender_username, u.avatar_url as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.room_id = $1 AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC
        LIMIT $2
      `;
            params = [roomId, limit + 1];
        }

        const result = await Database.query(query, params);
        const messages = result.rows;

        // Check if there are more messages
        let nextCursor: string | null = null;
        if (messages.length > limit) {
            nextCursor = messages[limit].id;
            messages.pop(); // Remove the extra message
        }

        // Reverse to show oldest first
        messages.reverse();

        return { messages, nextCursor };
    }

    /**
     * Get message by ID
     */
    static async getMessageById(messageId: string): Promise<Message | null> {
        const result = await Database.query(
            `SELECT * FROM messages WHERE id = $1`,
            [messageId]
        );

        return result.rows[0] || null;
    }

    /**
     * Get offline messages for a user (messages not yet delivered)
     */
    static async getOfflineMessages(userId: number): Promise<Message[]> {
        const result = await Database.query(
            `SELECT m.*, u.username as sender_username, u.avatar_url as sender_avatar
       FROM messages m
       JOIN message_receipts mr ON m.id = mr.message_id
       JOIN users u ON m.sender_id = u.id
       WHERE mr.user_id = $1 
         AND mr.delivered_at IS NULL
         AND m.deleted_at IS NULL
       ORDER BY m.created_at ASC`,
            [userId]
        );

        return result.rows;
    }

    /**
     * Create message receipts for all recipients
     */
    static async createMessageReceipts(
        messageId: string,
        recipientIds: number[]
    ): Promise<void> {
        if (recipientIds.length === 0) return;

        const values = recipientIds.map((_id, idx) =>
            `($1, $${idx + 2})`
        ).join(', ');

        await Database.query(
            `INSERT INTO message_receipts (message_id, user_id)
       VALUES ${values}
       ON CONFLICT (message_id, user_id) DO NOTHING`,
            [messageId, ...recipientIds]
        );
    }

    /**
     * Mark message as delivered for a specific user
     */
    static async markAsDelivered(messageId: string, userId: number): Promise<void> {
        await Database.query(
            `UPDATE message_receipts 
       SET delivered_at = CURRENT_TIMESTAMP
       WHERE message_id = $1 AND user_id = $2 AND delivered_at IS NULL`,
            [messageId, userId]
        );
    }

    /**
     * Mark multiple messages as delivered (used for offline message batch delivery)
     */
    static async markMessagesAsDelivered(
        messageIds: string[],
        userId: number
    ): Promise<void> {
        if (messageIds.length === 0) return;

        await Database.query(
            `UPDATE message_receipts 
       SET delivered_at = CURRENT_TIMESTAMP
       WHERE message_id = ANY($1) AND user_id = $2 AND delivered_at IS NULL`,
            [messageIds, userId]
        );
    }

    /**
     * Mark message as read for a specific user
     */
    static async markAsRead(messageId: string, userId: number): Promise<void> {
        await Database.query(
            `UPDATE message_receipts 
       SET read_at = CURRENT_TIMESTAMP,
           delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
       WHERE message_id = $1 AND user_id = $2`,
            [messageId, userId]
        );
    }

    /**
     * Get message receipt status for a message
     */
    static async getMessageReceipts(messageId: string): Promise<any[]> {
        const result = await Database.query(
            `SELECT mr.*, u.username, u.avatar_url
       FROM message_receipts mr
       JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = $1`,
            [messageId]
        );

        return result.rows;
    }

    /**
     * Pin a message
     */
    static async pinMessage(messageId: string): Promise<void> {
        await Database.query(
            `UPDATE messages SET is_pinned = TRUE WHERE id = $1`,
            [messageId]
        );
    }

    /**
     * Unpin a message
     */
    static async unpinMessage(messageId: string): Promise<void> {
        await Database.query(
            `UPDATE messages SET is_pinned = FALSE WHERE id = $1`,
            [messageId]
        );
    }

    /**
     * Get all pinned messages for a room
     */
    static async getPinnedMessages(roomId: number): Promise<any[]> {
        const result = await Database.query(
            `SELECT m.*, u.username as sender_username, u.avatar_url as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.room_id = $1 AND m.is_pinned = TRUE AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC`,
            [roomId]
        );
        return result.rows;
    }
}
