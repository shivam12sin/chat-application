import Database from '../config/database';

export interface CallLog {
    id: number;
    room_id: number | null;
    caller_id: number;
    callee_id: number;
    call_type: 'voice' | 'video';
    status: 'missed' | 'rejected' | 'completed';
    started_at: Date;
    ended_at: Date | null;
    duration_seconds: number;
    created_at: Date;
}

export class CallRepository {
    /**
     * Create a new call log
     */
    static async createCallLog(
        roomId: number | null,
        callerId: number,
        calleeId: number,
        callType: 'voice' | 'video'
    ): Promise<CallLog> {
        const result = await Database.query(
            `INSERT INTO call_logs (room_id, caller_id, callee_id, call_type, status, started_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING *`,
            [roomId, callerId, calleeId, callType, 'missed'] // Default to missed until completed
        );
        return result.rows[0];
    }

    /**
     * Update call log status and duration
     */
    static async updateCallStatus(
        callId: number,
        status: 'missed' | 'rejected' | 'completed',
        durationSeconds: number = 0
    ): Promise<CallLog> {
        const result = await Database.query(
            `UPDATE call_logs
             SET status = $2,
                 duration_seconds = $3,
                 ended_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [callId, status, durationSeconds]
        );
        return result.rows[0];
    }

    /**
     * Get call logs for a room (or direct between users)
     */
    static async getCallHistory(userId: number, limit: number = 20, offset: number = 0): Promise<CallLog[]> {
        const result = await Database.query(
            `SELECT c.*, 
                  caller.username as caller_username, caller.display_name as caller_display_name, caller.avatar_url as caller_avatar_url,
                  callee.username as callee_username, callee.display_name as callee_display_name, callee.avatar_url as callee_avatar_url
           FROM call_logs c
           JOIN users caller ON c.caller_id = caller.id
           JOIN users callee ON c.callee_id = callee.id
           WHERE c.caller_id = $1 OR c.callee_id = $1
           ORDER BY c.created_at DESC
           LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        return result.rows;
    }
}
