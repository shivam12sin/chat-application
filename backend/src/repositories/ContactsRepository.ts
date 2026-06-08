import Database from '../config/database';

export class ContactsRepository {
    /**
     * Search users by username (excluding self)
     */
    static async searchUsers(username: string, currentUserId: number) {
        // Basic fuzzy search
        const query = `
      SELECT id, username, display_name, avatar_url 
      FROM users 
      WHERE username ILIKE $1 
      AND id != $2
      LIMIT 10
    `;
        const result = await Database.query(query, [`%${username}%`, currentUserId]);
        return result.rows;
    }

    /**
     * Check connection status between two users
     */
    static async getConnectionStatus(userA: number, userB: number) {
        // Check if friends
        const contactCheck = await Database.query(
            'SELECT id FROM contacts WHERE user_id = $1 AND contact_id = $2',
            [userA, userB]
        );
        if (contactCheck.rows.length > 0) return 'connected';

        // Check if request sent
        const requestCheck = await Database.query(
            'SELECT status, sender_id FROM friend_requests WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)',
            [userA, userB]
        );

        if (requestCheck.rows.length > 0) {
            const req = requestCheck.rows[0];
            if (req.status === 'pending') {
                return req.sender_id === userA ? 'sent' : 'received';
            }
        }

        return 'none';
    }

    /**
     * Send a friend request
     */
    static async sendRequest(senderId: number, receiverId: number) {
        const existing = await this.getConnectionStatus(senderId, receiverId);
        if (existing !== 'none') {
            throw new Error('Connection status is not empty: ' + existing);
        }

        const query = `
      INSERT INTO friend_requests (sender_id, receiver_id)
      VALUES ($1, $2)
      RETURNING id, status, created_at
    `;
        const result = await Database.query(query, [senderId, receiverId]);
        return result.rows[0];
    }

    /**
     * Accept a friend request
     */
    static async acceptRequest(requestId: number, receiverId: number) {
        // Start transaction
        const client = await Database.getClient();
        try {
            await client.query('BEGIN');

            // 1. Verify request matches receiver
            const reqQuery = 'SELECT * FROM friend_requests WHERE id = $1 AND receiver_id = $2 FOR UPDATE';
            const reqRes = await client.query(reqQuery, [requestId, receiverId]);

            if (reqRes.rows.length === 0) {
                throw new Error('Request not found or unauthorized');
            }

            const request = reqRes.rows[0];
            if (request.status !== 'pending') {
                throw new Error('Request is not pending');
            }

            // 2. Update status
            await client.query(
                "UPDATE friend_requests SET status = 'accepted', updated_at = NOW() WHERE id = $1",
                [requestId]
            );

            // 3. Create room (Direct Message)
            // Check if room already exists just in case
            // For now, assume new room
            const roomRes = await client.query(
                "INSERT INTO rooms (room_type) VALUES ('direct') RETURNING id"
            );
            const roomId = roomRes.rows[0].id;

            // 4. Add members to room
            await client.query(
                "INSERT INTO room_members (room_id, user_id) VALUES ($1, $2), ($1, $3)",
                [roomId, request.sender_id, request.receiver_id]
            );

            // 5. Add to contacts (Both ways)
            const contactQuery = `
        INSERT INTO contacts (user_id, contact_id, room_id)
        VALUES 
          ($1, $2, $3),
          ($2, $1, $3)
        ON CONFLICT DO NOTHING
      `;
            await client.query(contactQuery, [request.sender_id, request.receiver_id, roomId]);

            await client.query('COMMIT');
            return { success: true, roomId };
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Reject a friend request
     */
    static async rejectRequest(requestId: number, receiverId: number) {
        const query = `
        UPDATE friend_requests 
        SET status = 'rejected', updated_at = NOW() 
        WHERE id = $1 AND receiver_id = $2
        RETURNING id
      `;
        const result = await Database.query(query, [requestId, receiverId]);
        return (result.rowCount || 0) > 0;
    }

    /**
     * Get pending received requests
     */
    static async getPendingRequests(userId: number) {
        const query = `
      SELECT fr.id, u.username, u.display_name, u.avatar_url, fr.created_at
      FROM friend_requests fr
      JOIN users u ON fr.sender_id = u.id
      WHERE fr.receiver_id = $1 AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `;
        const result = await Database.query(query, [userId]);
        return result.rows;
    }

    /**
     * Get all contacts
     */
    static async getContacts(userId: number) {
        const query = `
      SELECT c.id, c.room_id, u.id as user_id, u.username, u.display_name, u.avatar_url, u.last_seen
      FROM contacts c
      JOIN users u ON c.contact_id = u.id
      WHERE c.user_id = $1
      ORDER BY u.username ASC
    `;
        const result = await Database.query(query, [userId]);
        return result.rows;
    }
}
