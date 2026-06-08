import { AuthenticatedSocket } from '../index';
import Database from '../../config/database';

class PollHandler {
    /**
     * Handle voting on a poll
     */
    async handleVote(
        socket: AuthenticatedSocket,
        data: { pollId: string; optionIndex: number; roomId: number }
    ): Promise<void> {
        try {
            const { userId, username } = socket;
            const { pollId, optionIndex, roomId } = data;

            // 1. Check if poll exists and is open
            // For now, we assume all polls are open. In future, check 'closed_at'

            // 2. Record vote
            // The unique constraint (poll_id, user_id, option_index) handles duplicates for same option
            // If we want single choice only, we should delete previous votes first
            // But let's support multiple choice for now as per schema flexibility, 
            // or enforce single choice by deleting previous votes for this poll/user.

            // Let's assume single choice for now for simplicity, or check poll metadata.
            // Since we don't have easy access to poll metadata here without a query, 
            // let's just insert. If it fails due to constraint, it means they already voted for this option.

            await Database.query(
                `INSERT INTO poll_votes (poll_id, user_id, option_index)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (poll_id, user_id, option_index) DO NOTHING`,
                [pollId, userId, optionIndex]
            );

            // 3. Get updated poll results
            const results = await Database.query(
                `SELECT option_index, COUNT(*) as count
                 FROM poll_votes
                 WHERE poll_id = $1
                 GROUP BY option_index`,
                [pollId]
            );

            // 4. Broadcast update to room
            socket.to(`room:${roomId}`).emit('poll:update', {
                pollId,
                results: results.rows,
                voter: { id: userId, username }
            });

            // Send back to sender as well
            socket.emit('poll:update', {
                pollId,
                results: results.rows,
                voter: { id: userId, username }
            });

        } catch (error) {
            console.error('Error handling vote:', error);
            socket.emit('error', { message: 'Failed to record vote' });
        }
    }
}

export default new PollHandler();
