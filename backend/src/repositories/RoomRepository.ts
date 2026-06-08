import Database from '../config/database';

interface Room {
    id: number;
    name: string | null;
    room_type: 'direct' | 'group';
    description?: string;
    tone?: 'social' | 'focus' | 'work' | 'private';
    settings?: any;
    owner_id?: number;
    created_by: number | null;
    created_at: Date;
}

interface RoomMember {
    id: number;
    room_id: number;
    user_id: number;
    role: string;
    alias?: string;
    joined_at: Date;
}

export class RoomRepository {
    /**
     * Create a new room
     */
    static async createRoom(
        roomType: 'direct' | 'group',
        createdBy: number,
        name?: string,
        description?: string,
        tone: string = 'social',
        ownerId?: number
    ): Promise<Room> {
        const result = await Database.query(
            `INSERT INTO rooms (room_type, created_by, name, description, tone, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [roomType, createdBy, name || null, description || null, tone, ownerId || null]
        );

        return result.rows[0];
    }

    /**
     * Create a new Shared Space (Group)
     */
    static async createSpace(
        name: string,
        description: string,
        tone: string,
        ownerId: number,
        initialMembers: number[] = []
    ): Promise<Room> {
        // Create the room
        const room = await this.createRoom('group', ownerId, name, description, tone, ownerId);

        // Add owner as admin
        await this.addUserToRoom(room.id, ownerId, 'admin');

        // Add initial members
        for (const memberId of initialMembers) {
            if (memberId !== ownerId) {
                await this.addUserToRoom(room.id, memberId, 'member');
            }
        }

        return room;
    }

    /**
     * Add user to room
     */
    static async addUserToRoom(
        roomId: number,
        userId: number,
        role: string = 'member'
    ): Promise<RoomMember> {
        const result = await Database.query(
            `INSERT INTO room_members (room_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (room_id, user_id) 
       DO UPDATE SET left_at = NULL
       RETURNING *`,
            [roomId, userId, role]
        );

        return result.rows[0];
    }

    /**
     * Remove user from room (soft delete)
     */
    static async removeUserFromRoom(roomId: number, userId: number): Promise<void> {
        await Database.query(
            `UPDATE room_members 
       SET left_at = CURRENT_TIMESTAMP
       WHERE room_id = $1 AND user_id = $2`,
            [roomId, userId]
        );
    }

    /**
     * Check if user is a member of a room
     */
    static async isUserMemberOfRoom(userId: number, roomId: number): Promise<boolean> {
        const result = await Database.query(
            `SELECT 1 FROM room_members 
       WHERE user_id = $1 AND room_id = $2 AND left_at IS NULL`,
            [userId, roomId]
        );

        return result.rows.length > 0;
    }

    /**
     * Get all rooms a user is a member of
     */
    static async getUserRooms(userId: number): Promise<any[]> {
        const result = await Database.query(
            `SELECT r.id, 
              CASE 
                WHEN r.room_type = 'direct' THEN COALESCE(u_other.display_name, u_other.username)
                ELSE r.name 
              END as name,
              r.room_type,
              r.description,
              r.tone,
              r.settings,
              r.owner_id,
              r.created_by,
              r.created_at,
              m_last.content as last_message_content,
              m_last.created_at as last_message_at,
              u_last.username as last_sender_username,
              other_user.user_id as other_user_id,
              u_other.username as other_username,
              u_other.display_name as other_display_name
       FROM rooms r
       JOIN room_members rm ON r.id = rm.room_id
       LEFT JOIN LATERAL (
         SELECT m.content, m.created_at, m.sender_id
         FROM messages m
         WHERE m.room_id = r.id AND m.deleted_at IS NULL
         ORDER BY m.created_at DESC
         LIMIT 1
       ) m_last ON true
       LEFT JOIN users u_last ON m_last.sender_id = u_last.id
       LEFT JOIN LATERAL (
         SELECT rm2.user_id
         FROM room_members rm2
         WHERE rm2.room_id = r.id 
           AND rm2.user_id != $1 
           AND rm2.left_at IS NULL
         LIMIT 1
       ) other_user ON r.room_type = 'direct'
       LEFT JOIN users u_other ON other_user.user_id = u_other.id
       WHERE rm.user_id = $1 AND rm.left_at IS NULL
       ORDER BY COALESCE(m_last.created_at, r.created_at) DESC`,
            [userId]
        );

        return result.rows;
    }

    /**
     * Get room members
     */
    static async getRoomMembers(roomId: number): Promise<any[]> {
        const result = await Database.query(
            `SELECT rm.*, u.username, u.display_name, u.avatar_url, u.last_seen
       FROM room_members rm
       JOIN users u ON rm.user_id = u.id
       WHERE rm.room_id = $1 AND rm.left_at IS NULL`,
            [roomId]
        );

        return result.rows;
    }

    /**
     * Get room by ID
     */
    static async getRoomById(roomId: number): Promise<Room | null> {
        const result = await Database.query(
            `SELECT * FROM rooms WHERE id = $1`,
            [roomId]
        );

        return result.rows[0] || null;
    }

    /**
     * Update space settings
     */
    static async updateSpace(
        roomId: number,
        updates: { name?: string; description?: string; tone?: string; settings?: any }
    ): Promise<void> {
        const setClauses: string[] = [];
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
        if (updates.tone !== undefined) {
            setClauses.push(`tone = $${paramIndex++}`);
            values.push(updates.tone);
        }
        if (updates.settings !== undefined) {
            setClauses.push(`settings = $${paramIndex++}`);
            values.push(JSON.stringify(updates.settings));
        }

        if (setClauses.length === 0) return;

        values.push(roomId);
        await Database.query(
            `UPDATE rooms SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
            values
        );
    }

    /**
     * Find or create direct message room between two users
     */
    static async findOrCreateDirectRoom(userId1: number, userId2: number): Promise<Room> {
        // Check if DM already exists
        const existing = await Database.query(
            `SELECT r.* FROM rooms r
       JOIN room_members rm1 ON r.id = rm1.room_id AND rm1.user_id = $1
       JOIN room_members rm2 ON r.id = rm2.room_id AND rm2.user_id = $2
       WHERE r.room_type = 'direct'
         AND rm1.left_at IS NULL 
         AND rm2.left_at IS NULL
       LIMIT 1`,
            [userId1, userId2]
        );

        if (existing.rows.length > 0) {
            return existing.rows[0];
        }

        // Create new DM room
        const room = await this.createRoom('direct', userId1);
        await this.addUserToRoom(room.id, userId1, 'member');
        await this.addUserToRoom(room.id, userId2, 'member');

        return room;
    }

    /**
     * Set a member's alias in a room
     */
    static async setMemberAlias(
        roomId: number,
        userId: number,
        alias: string | null
    ): Promise<void> {
        await Database.query(
            `UPDATE room_members 
             SET alias = $1
             WHERE room_id = $2 AND user_id = $3 AND left_at IS NULL`,
            [alias, roomId, userId]
        );
    }

    /**
     * Get a member's alias in a room
     */
    static async getMemberAlias(roomId: number, userId: number): Promise<string | null> {
        const result = await Database.query(
            `SELECT alias FROM room_members 
             WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL`,
            [roomId, userId]
        );
        return result.rows[0]?.alias || null;
    }

    /**
     * Set chat lock status for a user in a room
     */
    static async setChatLock(
        roomId: number,
        userId: number,
        locked: boolean
    ): Promise<void> {
        await Database.query(
            `UPDATE room_members 
             SET is_locked = $1
             WHERE room_id = $2 AND user_id = $3 AND left_at IS NULL`,
            [locked, roomId, userId]
        );
    }

    /**
     * Get chat lock status for a user in a room
     */
    static async getChatLock(roomId: number, userId: number): Promise<boolean> {
        const result = await Database.query(
            `SELECT is_locked FROM room_members 
             WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL`,
            [roomId, userId]
        );
        return result.rows[0]?.is_locked || false;
    }

    /**
     * Get all locked room IDs for a user
     */
    static async getLockedRoomIds(userId: number): Promise<number[]> {
        const result = await Database.query(
            `SELECT room_id FROM room_members 
             WHERE user_id = $1 AND is_locked = TRUE AND left_at IS NULL`,
            [userId]
        );
        return result.rows.map(r => r.room_id);
    }
}
