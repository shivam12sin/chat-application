import Database from '../config/database';

interface Constellation {
    id: number;
    user_id: number;
    name: string;
    description?: string;
    created_at: Date;
    updated_at: Date;
}

interface ConstellationMessage {
    id: number;
    constellation_id: number;
    message_id: string;  // UUID
    room_id: number;
    added_at: Date;
}

export class ConstellationRepository {
    /**
     * Create a new constellation
     */
    static async createConstellation(
        userId: number,
        name: string,
        description?: string
    ): Promise<Constellation> {
        const result = await Database.query(
            `INSERT INTO constellations (user_id, name, description)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [userId, name, description || null]
        );
        return result.rows[0];
    }

    /**
     * Get all constellations for a user
     */
    static async getUserConstellations(userId: number): Promise<(Constellation & { message_count: number })[]> {
        const result = await Database.query(
            `SELECT c.*, 
                    COALESCE(COUNT(cm.id), 0)::int as message_count
             FROM constellations c
             LEFT JOIN constellation_messages cm ON c.id = cm.constellation_id
             WHERE c.user_id = $1
             GROUP BY c.id
             ORDER BY c.updated_at DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Get a constellation by ID (with ownership check)
     */
    static async getConstellationById(userId: number, constellationId: number): Promise<Constellation | null> {
        const result = await Database.query(
            `SELECT * FROM constellations WHERE id = $1 AND user_id = $2`,
            [constellationId, userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Update constellation name/description
     */
    static async updateConstellation(
        userId: number,
        constellationId: number,
        updates: { name?: string; description?: string }
    ): Promise<Constellation | null> {
        const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
            setClauses.push(`name = $${paramIndex++}`);
            values.push(updates.name);
        }
        if (updates.description !== undefined) {
            setClauses.push(`description = $${paramIndex++}`);
            values.push(updates.description);
        }

        values.push(constellationId, userId);
        const result = await Database.query(
            `UPDATE constellations 
             SET ${setClauses.join(', ')} 
             WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
             RETURNING *`,
            values
        );
        return result.rows[0] || null;
    }

    /**
     * Delete a constellation
     */
    static async deleteConstellation(userId: number, constellationId: number): Promise<boolean> {
        const result = await Database.query(
            `DELETE FROM constellations WHERE id = $1 AND user_id = $2`,
            [constellationId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Add a message to a constellation
     */
    static async addMessageToConstellation(
        userId: number,
        constellationId: number,
        messageId: string,
        roomId: number
    ): Promise<ConstellationMessage | null> {
        // First verify ownership
        const constellation = await this.getConstellationById(userId, constellationId);
        if (!constellation) return null;

        try {
            const result = await Database.query(
                `INSERT INTO constellation_messages (constellation_id, message_id, room_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (constellation_id, message_id) DO NOTHING
                 RETURNING *`,
                [constellationId, messageId, roomId]
            );

            // Update constellation timestamp
            await Database.query(
                `UPDATE constellations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [constellationId]
            );

            return result.rows[0] || null;
        } catch (error) {
            console.error('Error adding message to constellation:', error);
            return null;
        }
    }

    /**
     * Remove a message from a constellation
     */
    static async removeMessageFromConstellation(
        userId: number,
        constellationId: number,
        messageId: string
    ): Promise<boolean> {
        // Verify ownership
        const constellation = await this.getConstellationById(userId, constellationId);
        if (!constellation) return false;

        const result = await Database.query(
            `DELETE FROM constellation_messages 
             WHERE constellation_id = $1 AND message_id = $2`,
            [constellationId, messageId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Get all messages in a constellation (with message details)
     */
    static async getConstellationMessages(
        userId: number,
        constellationId: number
    ): Promise<any[]> {
        // Verify ownership
        const constellation = await this.getConstellationById(userId, constellationId);
        if (!constellation) return [];

        const result = await Database.query(
            `SELECT cm.*, 
                    m.content, m.message_type, m.created_at as message_created_at,
                    m.sender_id, u.username as sender_username, u.display_name as sender_display_name,
                    r.name as room_name, r.room_type
             FROM constellation_messages cm
             JOIN messages m ON cm.message_id = m.id
             JOIN users u ON m.sender_id = u.id
             JOIN rooms r ON cm.room_id = r.id
             WHERE cm.constellation_id = $1
             ORDER BY cm.added_at DESC`,
            [constellationId]
        );
        return result.rows;
    }

    /**
     * Check if a message is in any of user's constellations
     */
    static async getConstellationsForMessage(userId: number, messageId: string): Promise<number[]> {
        const result = await Database.query(
            `SELECT c.id 
             FROM constellations c
             JOIN constellation_messages cm ON c.id = cm.constellation_id
             WHERE c.user_id = $1 AND cm.message_id = $2`,
            [userId, messageId]
        );
        return result.rows.map(r => r.id);
    }
}
