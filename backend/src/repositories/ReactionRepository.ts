import Database from '../config/database';

interface Reaction {
    id: number;
    message_id: string;
    user_id: number;
    emoji: string;
    created_at: Date;
}

interface ReactionCount {
    emoji: string;
    count: number;
    users: number[];
}

export class ReactionRepository {
    /**
     * Initialize the reactions table if not exists
     */
    static async initTable(): Promise<void> {
        await Database.query(`
            CREATE TABLE IF NOT EXISTS message_reactions (
                id SERIAL PRIMARY KEY,
                message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                emoji VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(message_id, user_id, emoji)
            )
        `);

        // Create index for faster queries
        await Database.query(`
            CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON message_reactions(message_id)
        `);
    }

    /**
     * Add a reaction to a message
     */
    static async addReaction(messageId: string, userId: number, emoji: string): Promise<Reaction | null> {
        try {
            const result = await Database.query(
                `INSERT INTO message_reactions (message_id, user_id, emoji)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (message_id, user_id, emoji) DO NOTHING
                 RETURNING *`,
                [messageId, userId, emoji]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error adding reaction:', error);
            throw error;
        }
    }

    /**
     * Remove a reaction from a message
     */
    static async removeReaction(messageId: string, userId: number, emoji: string): Promise<boolean> {
        const result = await Database.query(
            `DELETE FROM message_reactions 
             WHERE message_id = $1 AND user_id = $2 AND emoji = $3
             RETURNING id`,
            [messageId, userId, emoji]
        );
        return (result.rowCount || 0) > 0;
    }

    /**
     * Get all reactions for a message (grouped by emoji with counts)
     */
    static async getReactionsForMessage(messageId: string): Promise<ReactionCount[]> {
        const result = await Database.query(
            `SELECT 
                emoji,
                COUNT(*) as count,
                ARRAY_AGG(user_id) as users
             FROM message_reactions
             WHERE message_id = $1
             GROUP BY emoji
             ORDER BY COUNT(*) DESC`,
            [messageId]
        );

        return result.rows.map(row => ({
            emoji: row.emoji,
            count: parseInt(row.count),
            users: row.users
        }));
    }

    /**
     * Check if user already reacted with specific emoji
     */
    static async hasUserReacted(messageId: string, userId: number, emoji: string): Promise<boolean> {
        const result = await Database.query(
            `SELECT id FROM message_reactions
             WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
            [messageId, userId, emoji]
        );
        return (result.rowCount || 0) > 0;
    }

    /**
     * Toggle reaction (add if not exists, remove if exists)
     */
    static async toggleReaction(messageId: string, userId: number, emoji: string): Promise<{ added: boolean; reaction?: Reaction }> {
        const exists = await this.hasUserReacted(messageId, userId, emoji);

        if (exists) {
            await this.removeReaction(messageId, userId, emoji);
            return { added: false };
        } else {
            const reaction = await this.addReaction(messageId, userId, emoji);
            return { added: true, reaction: reaction || undefined };
        }
    }
}
