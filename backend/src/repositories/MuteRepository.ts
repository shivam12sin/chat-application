import Database from '../config/database';

export interface MutedItem {
    id: number;
    user_id: number;
    muted_user_id?: number;
    muted_room_id?: number;
    muted_username?: string;
    muted_room_name?: string;
    mute_until?: Date;
    created_at: Date;
}

export class MuteRepository {
    /**
     * Mute a user
     */
    static async muteUser(userId: number, mutedUserId: number, until?: Date): Promise<void> {
        await Database.query(
            `INSERT INTO user_mutes (user_id, muted_user_id, mute_until)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [userId, mutedUserId, until || null]
        );
    }

    /**
     * Mute a room
     */
    static async muteRoom(userId: number, roomId: number, until?: Date): Promise<void> {
        await Database.query(
            `INSERT INTO user_mutes (user_id, muted_room_id, mute_until)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [userId, roomId, until || null]
        );
    }

    /**
     * Unmute a user
     */
    static async unmuteUser(userId: number, mutedUserId: number): Promise<boolean> {
        const result = await Database.query(
            `DELETE FROM user_mutes WHERE user_id = $1 AND muted_user_id = $2`,
            [userId, mutedUserId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Unmute a room
     */
    static async unmuteRoom(userId: number, roomId: number): Promise<boolean> {
        const result = await Database.query(
            `DELETE FROM user_mutes WHERE user_id = $1 AND muted_room_id = $2`,
            [userId, roomId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Check if a user is muted (considers mute_until expiry)
     */
    static async isUserMuted(userId: number, mutedUserId: number): Promise<boolean> {
        const result = await Database.query(
            `SELECT 1 FROM user_mutes 
             WHERE user_id = $1 AND muted_user_id = $2
             AND (mute_until IS NULL OR mute_until > NOW())`,
            [userId, mutedUserId]
        );
        return result.rows.length > 0;
    }

    /**
     * Check if a room is muted (considers mute_until expiry)
     */
    static async isRoomMuted(userId: number, roomId: number): Promise<boolean> {
        const result = await Database.query(
            `SELECT 1 FROM user_mutes 
             WHERE user_id = $1 AND muted_room_id = $2
             AND (mute_until IS NULL OR mute_until > NOW())`,
            [userId, roomId]
        );
        return result.rows.length > 0;
    }

    /**
     * Get all muted users and rooms for a user
     */
    static async getMutedList(userId: number): Promise<MutedItem[]> {
        const result = await Database.query(
            `SELECT um.*, 
                    u.username as muted_username,
                    r.name as muted_room_name
             FROM user_mutes um
             LEFT JOIN users u ON u.id = um.muted_user_id
             LEFT JOIN rooms r ON r.id = um.muted_room_id
             WHERE um.user_id = $1
             AND (um.mute_until IS NULL OR um.mute_until > NOW())
             ORDER BY um.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Get all muted room IDs for a user (for filtering notifications)
     */
    static async getMutedRoomIds(userId: number): Promise<number[]> {
        const result = await Database.query(
            `SELECT muted_room_id FROM user_mutes 
             WHERE user_id = $1 AND muted_room_id IS NOT NULL
             AND (mute_until IS NULL OR mute_until > NOW())`,
            [userId]
        );
        return result.rows.map(r => r.muted_room_id);
    }

    /**
     * Clean up expired mutes
     */
    static async cleanupExpiredMutes(): Promise<number> {
        const result = await Database.query(
            `DELETE FROM user_mutes WHERE mute_until IS NOT NULL AND mute_until < NOW()`
        );
        return result.rowCount ?? 0;
    }
}
