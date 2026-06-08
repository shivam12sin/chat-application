import { AuthenticatedSocket } from '../index';
import { ConstellationRepository } from '../../repositories/ConstellationRepository';

class ConstellationHandler {
    /**
     * Create a new constellation
     */
    async handleCreateConstellation(
        socket: AuthenticatedSocket,
        data: { name: string; description?: string },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { name, description } = data;

            if (!name?.trim()) {
                callback({ error: 'Name is required' });
                return;
            }

            const constellation = await ConstellationRepository.createConstellation(
                userId,
                name.trim(),
                description?.trim()
            );

            callback({ success: true, constellation });
            console.log(`Constellation "${name}" created by ${socket.username}`);
        } catch (error) {
            console.error('Error creating constellation:', error);
            callback({ error: 'Failed to create constellation' });
        }
    }

    /**
     * Get all user's constellations
     */
    async handleGetConstellations(
        socket: AuthenticatedSocket,
        _data: any,
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const constellations = await ConstellationRepository.getUserConstellations(userId);
            callback({ constellations });
        } catch (error) {
            console.error('Error getting constellations:', error);
            callback({ error: 'Failed to get constellations' });
        }
    }

    /**
     * Update a constellation
     */
    async handleUpdateConstellation(
        socket: AuthenticatedSocket,
        data: { constellationId: number; name?: string; description?: string },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { constellationId, name, description } = data;

            const updated = await ConstellationRepository.updateConstellation(
                userId,
                constellationId,
                { name: name?.trim(), description: description?.trim() }
            );

            if (!updated) {
                callback({ error: 'Constellation not found or access denied' });
                return;
            }

            callback({ success: true, constellation: updated });
        } catch (error) {
            console.error('Error updating constellation:', error);
            callback({ error: 'Failed to update constellation' });
        }
    }

    /**
     * Delete a constellation
     */
    async handleDeleteConstellation(
        socket: AuthenticatedSocket,
        data: { constellationId: number },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { constellationId } = data;

            const deleted = await ConstellationRepository.deleteConstellation(userId, constellationId);

            if (!deleted) {
                callback({ error: 'Constellation not found or access denied' });
                return;
            }

            callback({ success: true });
            console.log(`Constellation ${constellationId} deleted by ${socket.username}`);
        } catch (error) {
            console.error('Error deleting constellation:', error);
            callback({ error: 'Failed to delete constellation' });
        }
    }

    /**
     * Add a message to a constellation
     */
    async handleAddMessage(
        socket: AuthenticatedSocket,
        data: { constellationId: number; messageId: string; roomId: number },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { constellationId, messageId, roomId } = data;

            const added = await ConstellationRepository.addMessageToConstellation(
                userId,
                constellationId,
                messageId,
                roomId
            );

            if (!added) {
                callback({ error: 'Failed to add message (may already exist or access denied)' });
                return;
            }

            callback({ success: true, entry: added });
        } catch (error) {
            console.error('Error adding message to constellation:', error);
            callback({ error: 'Failed to add message' });
        }
    }

    /**
     * Remove a message from a constellation
     */
    async handleRemoveMessage(
        socket: AuthenticatedSocket,
        data: { constellationId: number; messageId: string },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { constellationId, messageId } = data;

            const removed = await ConstellationRepository.removeMessageFromConstellation(
                userId,
                constellationId,
                messageId
            );

            if (!removed) {
                callback({ error: 'Message not found or access denied' });
                return;
            }

            callback({ success: true });
        } catch (error) {
            console.error('Error removing message from constellation:', error);
            callback({ error: 'Failed to remove message' });
        }
    }

    /**
     * Get all messages in a constellation
     */
    async handleGetMessages(
        socket: AuthenticatedSocket,
        data: { constellationId: number },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { constellationId } = data;

            const messages = await ConstellationRepository.getConstellationMessages(userId, constellationId);
            callback({ messages });
        } catch (error) {
            console.error('Error getting constellation messages:', error);
            callback({ error: 'Failed to get messages' });
        }
    }

    /**
     * Get which constellations contain a specific message
     */
    async handleGetConstellationsForMessage(
        socket: AuthenticatedSocket,
        data: { messageId: string },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { messageId } = data;

            const constellationIds = await ConstellationRepository.getConstellationsForMessage(userId, messageId);
            callback({ constellationIds });
        } catch (error) {
            console.error('Error getting constellations for message:', error);
            callback({ error: 'Failed to get constellations' });
        }
    }
}

export default new ConstellationHandler();
