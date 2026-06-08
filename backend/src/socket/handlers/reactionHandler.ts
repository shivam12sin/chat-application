import { AuthenticatedSocket } from '../index';
import { ReactionRepository } from '../../repositories/ReactionRepository';
import { MessageRepository } from '../../repositories/MessageRepository';

interface ReactionData {
    messageId: string;
    roomId: number;
    emoji: string;
}

class ReactionHandler {
    /**
     * Handle toggling a reaction on a message
     * Adds the reaction if it doesn't exist, removes it if it does
     * Broadcasts the updated reactions to all users in the room
     */
    async handleToggleReaction(
        socket: AuthenticatedSocket,
        data: ReactionData,
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { userId, username } = socket;
            const { messageId, roomId, emoji } = data;

            // Validate input
            if (!messageId || !emoji) {
                callback?.({ success: false, error: 'Message ID and emoji are required' });
                return;
            }

            // Verify the message exists
            const message = await MessageRepository.getMessageById(messageId);
            if (!message) {
                callback?.({ success: false, error: 'Message not found' });
                return;
            }

            // Toggle the reaction (add if not exists, remove if exists)
            const result = await ReactionRepository.toggleReaction(messageId, userId, emoji);

            // Get updated reactions for the message
            const reactions = await ReactionRepository.getReactionsForMessage(messageId);

            // Broadcast to all users in the room (including sender)
            socket.to(`room:${roomId}`).emit('reaction:update', {
                messageId,
                reactions,
                action: result.added ? 'added' : 'removed',
                emoji,
                userId,
                username
            });

            // Send acknowledgment to sender
            callback?.({
                success: true,
                added: result.added,
                reactions
            });

            console.log(`Reaction ${result.added ? 'added' : 'removed'}: ${emoji} on message ${messageId} by user ${userId}`);

        } catch (error) {
            console.error('Error handling reaction toggle:', error);
            callback?.({
                success: false,
                error: 'Failed to update reaction. Please try again.'
            });
        }
    }

    /**
     * Handle getting all reactions for a message
     */
    async handleGetReactions(
        _socket: AuthenticatedSocket,
        data: { messageId: string },
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { messageId } = data;

            if (!messageId) {
                callback?.({ success: false, error: 'Message ID is required' });
                return;
            }

            const reactions = await ReactionRepository.getReactionsForMessage(messageId);

            callback?.({
                success: true,
                reactions
            });

        } catch (error) {
            console.error('Error getting reactions:', error);
            callback?.({
                success: false,
                error: 'Failed to get reactions.'
            });
        }
    }
}

export default new ReactionHandler();
