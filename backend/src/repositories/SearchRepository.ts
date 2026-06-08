import Database from '../config/database';
import { searchMessages as searchElasticsearch, indexMessage } from '../config/elasticsearch';

interface SearchResult {
    id: string;
    room_id: number;
    room_name: string | null;
    sender_id: number;
    sender_username: string;
    content: string;
    message_type: string;
    created_at: Date;
    match_snippet: string;
}

export class SearchRepository {
    /**
     * Search messages within a specific room using Elasticsearch
     * Falls back to PostgreSQL if ES is unavailable
     */
    static async searchInRoom(
        roomId: number,
        query: string,
        limit: number = 20,
        offset: number = 0,
        filters?: { sender?: string; before?: string; after?: string }
    ): Promise<{ results: SearchResult[]; total: number }> {
        try {
            // Try Elasticsearch first
            const esResults = await searchElasticsearch(query, {
                roomId,
                sender: filters?.sender,
                before: filters?.before,
                after: filters?.after,
                limit,
                offset
            });

            // Enrich with room name from PostgreSQL
            if (esResults.results.length > 0) {
                const roomResult = await Database.query(
                    'SELECT name FROM rooms WHERE id = $1',
                    [roomId]
                );
                const roomName = roomResult.rows[0]?.name || null;
                esResults.results.forEach(r => r.room_name = roomName);
            }

            return esResults;
        } catch (error) {
            console.warn('Elasticsearch search failed, falling back to PostgreSQL:', error);
            return this.searchInRoomSQL(roomId, query, limit, offset, filters);
        }
    }

    /**
     * PostgreSQL fallback search (ILIKE for substring matching)
     */
    private static async searchInRoomSQL(
        roomId: number,
        query: string,
        limit: number = 20,
        offset: number = 0,
        filters?: { sender?: string; before?: string; after?: string }
    ): Promise<{ results: SearchResult[]; total: number }> {
        // Build dynamic WHERE conditions
        let whereConditions = `m.room_id = $1 AND m.deleted_at IS NULL`;
        const params: any[] = [roomId];
        let paramIndex = 2;

        // Use ILIKE for substring matching (works for any length)
        if (query.trim()) {
            whereConditions += ` AND m.content ILIKE $${paramIndex}`;
            params.push(`%${query.trim()}%`);
            paramIndex++;
        }

        if (filters?.sender) {
            whereConditions += ` AND u.username ILIKE $${paramIndex}`;
            params.push(`%${filters.sender}%`);
            paramIndex++;
        }

        if (filters?.before) {
            whereConditions += ` AND m.created_at < $${paramIndex}::date`;
            params.push(filters.before);
            paramIndex++;
        }

        if (filters?.after) {
            whereConditions += ` AND m.created_at >= $${paramIndex}::date`;
            params.push(filters.after);
            paramIndex++;
        }

        const countResult = await Database.query(
            `SELECT COUNT(*) as total
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE ${whereConditions}`,
            params
        );

        const selectParams = [...params, limit, offset];

        const result = await Database.query(
            `SELECT 
                m.id,
                m.room_id,
                r.name as room_name,
                m.sender_id,
                u.username as sender_username,
                m.content,
                m.message_type,
                m.created_at,
                m.content as match_snippet
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             JOIN rooms r ON m.room_id = r.id
             WHERE ${whereConditions}
             ORDER BY m.created_at DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            selectParams
        );

        return {
            results: result.rows,
            total: parseInt(countResult.rows[0].total, 10)
        };
    }

    /**
     * Global search across all rooms the user has access to
     */
    static async searchGlobal(
        userId: number,
        query: string,
        limit: number = 20,
        offset: number = 0
    ): Promise<{ results: SearchResult[]; total: number }> {
        try {
            // Get user's room IDs first
            const roomsResult = await Database.query(
                `SELECT room_id FROM room_members WHERE user_id = $1 AND left_at IS NULL`,
                [userId]
            );
            const roomIds = roomsResult.rows.map(r => r.room_id);

            if (roomIds.length === 0) {
                return { results: [], total: 0 };
            }

            // Search across all rooms using ES
            // Note: ES doesn't natively support "IN" filter, so we search without room filter
            // and filter results client-side, or make multiple calls
            // For simplicity, using PostgreSQL for global search
            return this.searchGlobalSQL(userId, query, limit, offset);
        } catch (error) {
            console.warn('Global search using PostgreSQL fallback');
            return this.searchGlobalSQL(userId, query, limit, offset);
        }
    }

    /**
     * PostgreSQL global search
     */
    private static async searchGlobalSQL(
        userId: number,
        query: string,
        limit: number = 20,
        offset: number = 0
    ): Promise<{ results: SearchResult[]; total: number }> {
        const countResult = await Database.query(
            `SELECT COUNT(*) as total
             FROM messages m
             JOIN room_members rm ON m.room_id = rm.room_id
             WHERE rm.user_id = $1
               AND rm.left_at IS NULL
               AND m.deleted_at IS NULL
               AND m.content ILIKE $2`,
            [userId, `%${query}%`]
        );

        const result = await Database.query(
            `SELECT 
                m.id,
                m.room_id,
                r.name as room_name,
                m.sender_id,
                u.username as sender_username,
                m.content,
                m.message_type,
                m.created_at,
                m.content as match_snippet
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             JOIN rooms r ON m.room_id = r.id
             JOIN room_members rm ON m.room_id = rm.room_id
             WHERE rm.user_id = $1
               AND rm.left_at IS NULL
               AND m.deleted_at IS NULL
               AND m.content ILIKE $2
             ORDER BY m.created_at DESC
             LIMIT $3 OFFSET $4`,
            [userId, `%${query}%`, limit, offset]
        );

        return {
            results: result.rows,
            total: parseInt(countResult.rows[0].total, 10)
        };
    }

    /**
     * Index a message to Elasticsearch (for real-time sync)
     */
    static async indexMessage(message: {
        id: string;
        room_id: number;
        sender_id: number;
        sender_username: string;
        content: string;
        message_type: string;
        created_at: Date | string;
    }): Promise<void> {
        await indexMessage(message);
    }

    /**
     * Simple search fallback (legacy)
     */
    static async searchSimple(
        roomId: number,
        query: string,
        limit: number = 20
    ): Promise<SearchResult[]> {
        const result = await Database.query(
            `SELECT 
                m.id,
                m.room_id,
                r.name as room_name,
                m.sender_id,
                u.username as sender_username,
                m.content,
                m.message_type,
                m.created_at,
                m.content as match_snippet
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             JOIN rooms r ON m.room_id = r.id
             WHERE m.room_id = $1 
               AND m.deleted_at IS NULL
               AND m.content ILIKE $2
             ORDER BY m.created_at DESC
             LIMIT $3`,
            [roomId, `%${query}%`, limit]
        );

        return result.rows;
    }
}
