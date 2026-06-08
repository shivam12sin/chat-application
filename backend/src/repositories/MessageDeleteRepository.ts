import Database from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { getElasticsearchClient, MESSAGES_INDEX } from '../config/elasticsearch';

interface PendingDelete {
    id: string;
    message_id: string;
    requester_id: number;
    room_id: number;
    message_data: any;
    delete_at: Date;
}

export class MessageDeleteRepository {
    /**
     * Initialize tables (call on server start)
     */
    static async initTables(): Promise<void> {
        await Database.query(`
            CREATE TABLE IF NOT EXISTS message_hidden_for (
                message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                hidden_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (message_id, user_id)
            )
        `);

        await Database.query(`
            CREATE TABLE IF NOT EXISTS pending_deletes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                message_id UUID NOT NULL,
                requester_id INTEGER NOT NULL,
                room_id INTEGER NOT NULL,
                message_data JSONB NOT NULL,
                delete_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await Database.query(`
            CREATE INDEX IF NOT EXISTS idx_message_hidden_user ON message_hidden_for(user_id)
        `);
    }

    /**
     * Hide message for a specific user ("Delete for Me")
     */
    static async hideForUser(messageId: string, userId: number): Promise<void> {
        await Database.query(
            `INSERT INTO message_hidden_for (message_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (message_id, user_id) DO NOTHING`,
            [messageId, userId]
        );
    }

    /**
     * Unhide message for a specific user (undo "Delete for Me")
     */
    static async unhideForUser(messageId: string, userId: number): Promise<void> {
        await Database.query(
            `DELETE FROM message_hidden_for WHERE message_id = $1 AND user_id = $2`,
            [messageId, userId]
        );
    }

    /**
     * Check if message is hidden for user
     */
    static async isHiddenForUser(messageId: string, userId: number): Promise<boolean> {
        const result = await Database.query(
            `SELECT 1 FROM message_hidden_for WHERE message_id = $1 AND user_id = $2`,
            [messageId, userId]
        );
        return result.rows.length > 0;
    }

    /**
     * Get all message IDs hidden for a user
     */
    static async getHiddenMessageIds(userId: number): Promise<string[]> {
        const result = await Database.query(
            `SELECT message_id FROM message_hidden_for WHERE user_id = $1`,
            [userId]
        );
        return result.rows.map(r => r.message_id);
    }

    /**
     * Schedule message for deletion ("Delete for Everyone")
     * Returns undo token and expiry time
     */
    static async scheduleDelete(
        messageId: string,
        requesterId: number,
        roomId: number,
        messageData: any
    ): Promise<{ undoToken: string; expiresAt: Date }> {
        const undoToken = uuidv4();
        const expiresAt = new Date(Date.now() + 7000); // 7 seconds

        await Database.query(
            `INSERT INTO pending_deletes (id, message_id, requester_id, room_id, message_data, delete_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [undoToken, messageId, requesterId, roomId, JSON.stringify(messageData), expiresAt]
        );

        // Mark message as "pending delete" in messages table (for UI)
        await Database.query(
            `UPDATE messages SET deleted_at = $2 WHERE id = $1`,
            [messageId, new Date()]
        );

        return { undoToken, expiresAt };
    }

    /**
     * Undo a pending delete
     */
    static async undoDelete(undoToken: string, requesterId: number): Promise<boolean> {
        // Check if pending delete exists and belongs to requester
        const result = await Database.query(
            `SELECT message_id FROM pending_deletes 
             WHERE id = $1 AND requester_id = $2 AND delete_at > NOW()`,
            [undoToken, requesterId]
        );

        if (result.rows.length === 0) {
            return false; // Expired or not found
        }

        const messageId = result.rows[0].message_id;

        // Restore message
        await Database.query(
            `UPDATE messages SET deleted_at = NULL WHERE id = $1`,
            [messageId]
        );

        // Remove from pending deletes
        await Database.query(
            `DELETE FROM pending_deletes WHERE id = $1`,
            [undoToken]
        );

        return true;
    }

    /**
     * Get pending delete by token
     */
    static async getPendingDelete(undoToken: string): Promise<PendingDelete | null> {
        const result = await Database.query(
            `SELECT * FROM pending_deletes WHERE id = $1`,
            [undoToken]
        );
        return result.rows[0] || null;
    }

    /**
     * Hard delete message (after 7s timeout)
     */
    static async hardDeleteMessage(messageId: string): Promise<void> {
        // Delete from messages table (cascade will handle related records)
        await Database.query(
            `DELETE FROM messages WHERE id = $1`,
            [messageId]
        );

        // Clean up pending_deletes
        await Database.query(
            `DELETE FROM pending_deletes WHERE message_id = $1`,
            [messageId]
        );

        // Remove from Elasticsearch for complete privacy
        try {
            const es = getElasticsearchClient();
            await es.delete({
                index: MESSAGES_INDEX,
                id: messageId
            });
        } catch (err) {
            // ES delete is best-effort, doesn't block
            console.warn('ES delete skipped:', (err as Error).message);
        }
    }

    /**
     * Get all expired pending deletes (for background job)
     */
    static async getExpiredPendingDeletes(): Promise<PendingDelete[]> {
        const result = await Database.query(
            `SELECT * FROM pending_deletes WHERE delete_at <= NOW()`
        );
        return result.rows;
    }

    /**
     * Process expired pending deletes (hard delete)
     */
    static async processExpiredDeletes(): Promise<number> {
        const expired = await this.getExpiredPendingDeletes();

        for (const pending of expired) {
            await this.hardDeleteMessage(pending.message_id);
        }

        return expired.length;
    }

    /**
     * Delete all messages for a user (Account Deletion)
     * Purges from Elasticsearch and Database
     */
    static async deleteAllMessagesForUser(userId: number): Promise<void> {
        // 1. Delete from Elasticsearch
        try {
            const es = getElasticsearchClient();
            await es.deleteByQuery({
                index: MESSAGES_INDEX,
                query: {
                    match: {
                        sender_id: userId
                    }
                }
            });
        } catch (err) {
            console.warn('ES user purge skipped:', (err as Error).message);
        }

        // 2. Delete from DB
        // Note: We don't need to iterate individual messages if we just kill them all
        await Database.query('DELETE FROM messages WHERE sender_id = $1', [userId]);
    }
}
