import { AuthenticatedSocket } from '../index';
import { RoomRepository } from '../../repositories/RoomRepository';

interface JoinRoomData {
    roomId: number;
}

interface LeaveRoomData {
    roomId: number;
}

interface CreateSpaceData {
    name: string;
    description: string;
    tone: string;
    initialMembers: number[];
}

class RoomHandler {
    /**
     * Handle user joining a room
     */
    async handleJoinRoom(
        socket: AuthenticatedSocket,
        data: JoinRoomData
    ): Promise<void> {
        try {
            const { userId, username } = socket;
            const { roomId } = data;

            // Verify user is a member of the room
            const isMember = await RoomRepository.isUserMemberOfRoom(userId, roomId);

            if (!isMember) {
                socket.emit('error', {
                    code: 'ROOM_ACCESS_DENIED',
                    message: 'You are not a member of this room',
                });
                return;
            }

            // Join the Socket.io room
            socket.join(`room:${roomId}`);

            // Notify other room members
            socket.to(`room:${roomId}`).emit('room:user_joined', {
                roomId,
                userId,
                username,
            });

            console.log(`User ${username} joined room ${roomId}`);

        } catch (error) {
            console.error('Error handling join room:', error);
            socket.emit('error', {
                code: 'ROOM_JOIN_ERROR',
                message: 'Failed to join room',
            });
        }
    }

    /**
     * Handle user leaving a room
     */
    async handleLeaveRoom(
        socket: AuthenticatedSocket,
        data: LeaveRoomData
    ): Promise<void> {
        try {
            const { userId, username } = socket;
            const { roomId } = data;

            // Leave the Socket.io room
            socket.leave(`room:${roomId}`);

            // Notify other room members
            socket.to(`room:${roomId}`).emit('room:user_left', {
                roomId,
                userId,
                username,
            });

            console.log(`User ${username} left room ${roomId}`);

        } catch (error) {
            console.error('Error handling leave room:', error);
        }
    }

    /**
     * Handle creating a new shared space
     */
    async handleCreateSpace(
        socket: AuthenticatedSocket,
        data: CreateSpaceData,
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { name, description, tone, initialMembers } = data;

            // Validate inputs
            if (!name || !tone) {
                callback({ error: 'Name and tone are required' });
                return;
            }

            // Create the space
            const space = await RoomRepository.createSpace(
                name,
                description,
                tone,
                userId,
                initialMembers
            );

            // Notify creator immediately via callback
            callback({ space });

            // Notify other members (invite logic)
            if (initialMembers && initialMembers.length > 0) {
                initialMembers.forEach(memberId => {
                    if (memberId !== userId) {
                        socket.to(`user:${memberId}`).emit('space:invited', {
                            spaceId: space.id,
                            name: space.name,
                            invitedBy: socket.username
                        });
                    }
                });
            }

            console.log(`Space created: ${name} by ${socket.username}`);

        } catch (error: any) {
            console.error('Error creating space:', error?.message || error);
            console.error('Error stack:', error?.stack);
            callback({ error: 'Failed to create space: ' + (error?.message || 'Unknown error') });
        }
    }

    /**
     * Handle inviting a user to a space
     */
    async handleInviteToSpace(
        socket: AuthenticatedSocket,
        data: { spaceId: number; userId: number },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId: inviterId, username: inviterName } = socket;
            const { spaceId, userId: inviteeId } = data;

            const isMember = await RoomRepository.isUserMemberOfRoom(inviterId, spaceId);
            if (!isMember) {
                callback({ error: 'You do not have permission to invite to this space.' });
                return;
            }

            await RoomRepository.addUserToRoom(spaceId, inviteeId, 'member');
            const space = await RoomRepository.getRoomById(spaceId);

            socket.to(`user:${inviteeId}`).emit('space:invited', {
                spaceId,
                name: space?.name,
                invitedBy: inviterName,
                space: space
            });

            socket.emit('space:member_added', { spaceId, userId: inviteeId });
            socket.to(`room:${spaceId}`).emit('space:member_added', { spaceId, userId: inviteeId });

            callback({ success: true });
            console.log(`User ${inviteeId} invited to space ${spaceId} by ${inviterName}`);

        } catch (error) {
            console.error('Error inviting to space:', error);
            callback({ error: 'Failed to invite user' });
        }
    }

    /**
     * Handle leaving a space
     */
    async handleLeaveSpace(
        socket: AuthenticatedSocket,
        data: { spaceId: number },
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { spaceId } = data;

            await RoomRepository.removeUserFromRoom(spaceId, userId);
            socket.leave(`room:${spaceId}`);
            socket.to(`room:${spaceId}`).emit('space:member_left', { spaceId, userId });

            if (callback) callback({ success: true });
            console.log(`User ${userId} left space ${spaceId}`);

        } catch (error) {
            console.error('Error leaving space:', error);
            if (callback) callback({ error: 'Failed to leave space' });
        }
    }

    /**
     * Handle updating space settings
     */
    async handleUpdateSpace(
        socket: AuthenticatedSocket,
        data: { spaceId: number; name?: string; description?: string; tone?: string; settings?: any },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { spaceId, name, description, tone, settings } = data;

            const isMember = await RoomRepository.isUserMemberOfRoom(userId, spaceId);
            if (!isMember) {
                callback({ error: 'You do not have permission to update this space.' });
                return;
            }

            await RoomRepository.updateSpace(spaceId, { name, description, tone, settings });
            const updatedSpace = await RoomRepository.getRoomById(spaceId);

            socket.emit('space:updated', { space: updatedSpace });
            socket.to(`room:${spaceId}`).emit('space:updated', { space: updatedSpace });

            callback({ success: true, space: updatedSpace });
            console.log(`Space ${spaceId} updated by ${socket.username}`);

        } catch (error) {
            console.error('Error updating space:', error);
            callback({ error: 'Failed to update space' });
        }
    }

    /**
     * Get space members
     */
    async handleGetSpaceMembers(
        _socket: AuthenticatedSocket,
        data: { spaceId: number },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { spaceId } = data;
            const members = await RoomRepository.getRoomMembers(spaceId);
            callback({ members });
        } catch (error) {
            console.error('Error getting space members:', error);
            callback({ error: 'Failed to get members' });
        }
    }

    /**
     * Handle setting member alias (optional tag like WhatsApp)
     */
    async handleSetMemberAlias(
        socket: AuthenticatedSocket,
        data: { spaceId: number; alias: string | null },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId, username } = socket;
            const { spaceId, alias } = data;

            // Verify user is a member
            const isMember = await RoomRepository.isUserMemberOfRoom(userId, spaceId);
            if (!isMember) {
                callback({ error: 'You are not a member of this space.' });
                return;
            }

            // Validate alias (max 50 chars, optional)
            const trimmedAlias = alias?.trim() || null;
            if (trimmedAlias && trimmedAlias.length > 50) {
                callback({ error: 'Alias must be 50 characters or less.' });
                return;
            }

            await RoomRepository.setMemberAlias(spaceId, userId, trimmedAlias);

            // Notify all room members about the alias change
            socket.emit('space:alias_updated', { spaceId, userId, alias: trimmedAlias, username });
            socket.to(`room:${spaceId}`).emit('space:alias_updated', { spaceId, userId, alias: trimmedAlias, username });

            callback({ success: true, alias: trimmedAlias });
            console.log(`User ${username} set alias to "${trimmedAlias}" in space ${spaceId}`);

        } catch (error) {
            console.error('Error setting member alias:', error);
            callback({ error: 'Failed to set alias' });
        }
    }

    /**
     * Handle locking a chat (toggle lock status)
     */
    async handleLockChat(
        socket: AuthenticatedSocket,
        data: { roomId: number; locked: boolean },
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId, username } = socket;
            const { roomId, locked } = data;

            // Verify user is a member
            const isMember = await RoomRepository.isUserMemberOfRoom(userId, roomId);
            if (!isMember) {
                callback({ error: 'You are not a member of this room.' });
                return;
            }

            await RoomRepository.setChatLock(roomId, userId, locked);

            callback({ success: true, roomId, locked });
            console.log(`User ${username} ${locked ? 'locked' : 'unlocked'} room ${roomId}`);

        } catch (error) {
            console.error('Error locking chat:', error);
            callback({ error: 'Failed to update lock status' });
        }
    }

    /**
     * Handle getting locked room IDs for current user
     */
    async handleGetLockedRooms(
        socket: AuthenticatedSocket,
        _data: Record<string, never>,
        callback: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const lockedRoomIds = await RoomRepository.getLockedRoomIds(userId);
            callback({ lockedRoomIds });
        } catch (error) {
            console.error('Error getting locked rooms:', error);
            callback({ error: 'Failed to get locked rooms' });
        }
    }
}

export default new RoomHandler();
