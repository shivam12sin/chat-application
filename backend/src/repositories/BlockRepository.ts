import Database from '../config/database';

export interface BlockedUser {
    id: number;
    blocker_id: number;
    blocked_id: number;
    blocked_username?: string;
    created_at: Date;
}

export class BlockRepository {
    /**
     * Block a user
     */
    static async blockUser(blockerId: number, blockedId: number): Promise<void> {
        await Database.query(
            `INSERT INTO user_blocks (blocker_id, blocked_id)
             VALUES ($1, $2)
             ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
            [blockerId, blockedId]
        );
    }

    /**
     * Unblock a user
     */
    static async unblockUser(blockerId: number, blockedId: number): Promise<boolean> {
        const result = await Database.query(
            `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
            [blockerId, blockedId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Check if user A has blocked user B
     */
    static async isBlocked(blockerId: number, blockedId: number): Promise<boolean> {
        const result = await Database.query(
            `SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
            [blockerId, blockedId]
        );
        return result.rows.length > 0;
    }

    /**
     * Check if either user has blocked the other (for DM prevention)
     */
    static async isEitherBlocked(userId1: number, userId2: number): Promise<boolean> {
        const result = await Database.query(
            `SELECT 1 FROM user_blocks 
             WHERE (blocker_id = $1 AND blocked_id = $2) 
                OR (blocker_id = $2 AND blocked_id = $1)`,
            [userId1, userId2]
        );
        return result.rows.length > 0;
    }

    /**
     * Get all users blocked by a user
     */
    static async getBlockedUsers(userId: number): Promise<BlockedUser[]> {
        const result = await Database.query(
            `SELECT ub.*, u.username as blocked_username
             FROM user_blocks ub
             JOIN users u ON u.id = ub.blocked_id
             WHERE ub.blocker_id = $1
             ORDER BY ub.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Get all user IDs blocked by a user (for filtering)
     */
    static async getBlockedUserIds(userId: number): Promise<number[]> {
        const result = await Database.query(
            `SELECT blocked_id FROM user_blocks WHERE blocker_id = $1`,
            [userId]
        );
        return result.rows.map(r => r.blocked_id);
    }
}
