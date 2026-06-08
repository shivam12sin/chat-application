/**
 * E2E Encryption Socket Handler
 * 
 * Handles real-time E2E encryption operations:
 * - Sender key distribution for group encryption
 * - Key change notifications
 * - Session establishment signals
 */

import { AuthenticatedSocket } from '../index';
import { E2EKeyRepository } from '../../repositories/E2EKeyRepository';
import { RoomRepository } from '../../repositories/RoomRepository';

// ============================================
// TYPES
// ============================================

interface SenderKeyDistributionData {
    roomId: number;
    distribution: string;  // Base64 encoded sender key distribution message
}

interface KeyRotationNotification {
    roomId: number;
    reason: 'member_left' | 'scheduled' | 'manual';
    newKeyId?: number;
}

interface SessionEstablishRequest {
    targetUserId: number;
    preKeyBundle?: string;  // Base64 encoded, only if initiating
}

interface KeyChangeNotification {
    userId: number;
    keyType: 'identity' | 'signed_prekey';
}

// ============================================
// HANDLER CLASS
// ============================================

class E2EHandler {
    /**
     * Handle sender key distribution for group encryption
     * When a user sends a message in an E2E group, they first distribute their sender key
     */
    async handleSenderKeyDistribution(
        socket: AuthenticatedSocket,
        data: SenderKeyDistributionData,
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { userId, username } = socket;
            const { roomId, distribution } = data;

            // Validate distribution data
            if (!roomId || !distribution) {
                callback?.({ success: false, error: 'Missing required fields' });
                return;
            }

            // Verify user is member of room
            const isMember = await RoomRepository.isUserMemberOfRoom(userId, roomId);
            if (!isMember) {
                callback?.({ success: false, error: 'You are not a member of this room' });
                return;
            }

            // Broadcast sender key distribution to all room members
            // This allows other members to decrypt messages from this sender
            socket.to(`room:${roomId}`).emit('e2e:sender_key', {
                roomId,
                senderId: userId,
                senderUsername: username,
                distribution,
                timestamp: new Date().toISOString(),
            });

            callback?.({
                success: true,
                message: 'Sender key distributed successfully',
            });

            console.log(`E2E: Sender key distributed by ${username} in room ${roomId}`);

        } catch (error) {
            console.error('Error handling sender key distribution:', error);
            callback?.({ success: false, error: 'Failed to distribute sender key' });
        }
    }

    /**
     * Handle sender key rotation notification
     * When a member leaves a group, remaining members rotate their sender keys
     */
    async handleKeyRotation(
        socket: AuthenticatedSocket,
        data: KeyRotationNotification,
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { userId, username } = socket;
            const { roomId, reason, newKeyId } = data;

            // Verify user is member of room
            const isMember = await RoomRepository.isUserMemberOfRoom(userId, roomId);
            if (!isMember) {
                callback?.({ success: false, error: 'You are not a member of this room' });
                return;
            }

            // If new key ID provided, update in database
            if (newKeyId !== undefined) {
                // Note: The actual key storage is handled via REST API
                // This is just a notification to other members
            }

            // Notify room members about key rotation
            socket.to(`room:${roomId}`).emit('e2e:key_rotated', {
                roomId,
                userId,
                username,
                reason,
                newKeyId,
                timestamp: new Date().toISOString(),
            });

            callback?.({
                success: true,
                message: 'Key rotation notification sent',
            });

            console.log(`E2E: Key rotation by ${username} in room ${roomId} (reason: ${reason})`);

        } catch (error) {
            console.error('Error handling key rotation:', error);
            callback?.({ success: false, error: 'Failed to notify key rotation' });
        }
    }

    /**
     * Handle session establishment request
     * Used when initiating a DM E2E session with X3DH
     */
    async handleSessionEstablish(
        socket: AuthenticatedSocket,
        data: SessionEstablishRequest,
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { targetUserId, preKeyBundle } = data;

            // Validate target user
            if (!targetUserId) {
                callback?.({ success: false, error: 'Target user ID required' });
                return;
            }

            // Check if target user has E2E enabled
            const targetHasE2E = await E2EKeyRepository.hasRegisteredKeys(targetUserId);
            if (!targetHasE2E) {
                callback?.({
                    success: false,
                    error: 'Target user does not have E2E encryption enabled',
                    e2eEnabled: false,
                });
                return;
            }

            // If this is an initial session establishment with pre-key bundle
            if (preKeyBundle) {
                // Notify target user about new session
                // This allows them to know someone is trying to establish E2E
                socket.to(`user:${targetUserId}`).emit('e2e:session_request', {
                    fromUserId: userId,
                    preKeyBundle,
                    timestamp: new Date().toISOString(),
                });
            }

            callback?.({
                success: true,
                e2eEnabled: true,
            });

        } catch (error) {
            console.error('Error handling session establishment:', error);
            callback?.({ success: false, error: 'Failed to establish session' });
        }
    }

    /**
     * Handle key change notification
     * When a user's identity key changes (potential security event)
     */
    async handleKeyChange(
        socket: AuthenticatedSocket,
        data: KeyChangeNotification,
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { userId: observerUserId } = socket;
            const { userId: changedUserId, keyType } = data;

            // Get all rooms where both users are members
            // Notify the observer about the key change in those contexts
            
            // This is a critical security event - users should re-verify
            console.log(`E2E: Key change detected for user ${changedUserId} (type: ${keyType}) by ${observerUserId}`);

            callback?.({
                success: true,
                message: 'Key change acknowledged',
            });

        } catch (error) {
            console.error('Error handling key change:', error);
            callback?.({ success: false, error: 'Failed to process key change' });
        }
    }

    /**
     * Request sender keys for a room (when joining)
     * New members need existing members' sender keys to decrypt messages
     */
    async handleRequestSenderKeys(
        socket: AuthenticatedSocket,
        data: { roomId: number },
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { userId, username } = socket;
            const { roomId } = data;

            // Verify user is member of room
            const isMember = await RoomRepository.isUserMemberOfRoom(userId, roomId);
            if (!isMember) {
                callback?.({ success: false, error: 'You are not a member of this room' });
                return;
            }

            // Get all sender keys for this room from database
            const senderKeys = await E2EKeyRepository.getRoomSenderKeys(roomId);

            // Also notify room members that this user needs sender keys
            // This prompts them to send their current sender key
            socket.to(`room:${roomId}`).emit('e2e:sender_key_request', {
                roomId,
                requesterId: userId,
                requesterUsername: username,
                timestamp: new Date().toISOString(),
            });

            callback?.({
                success: true,
                senderKeys: senderKeys.map(sk => ({
                    senderUserId: sk.senderUserId,
                    distributionKeyPublic: sk.distributionKeyPublic.toString('base64'),
                    distributionKeyId: sk.distributionKeyId,
                    chainIteration: sk.chainIteration,
                })),
            });

            console.log(`E2E: Sender keys requested by ${username} for room ${roomId}`);

        } catch (error) {
            console.error('Error handling sender key request:', error);
            callback?.({ success: false, error: 'Failed to request sender keys' });
        }
    }

    /**
     * Acknowledge receipt of sender key
     * Helps track which members have received which keys
     */
    async handleSenderKeyAck(
        socket: AuthenticatedSocket,
        data: { roomId: number; senderUserId: number; keyId: number },
        callback?: (response: any) => void
    ): Promise<void> {
        try {
            const { userId } = socket;
            const { roomId, senderUserId, keyId } = data;

            // Notify the sender that their key was received
            socket.to(`user:${senderUserId}`).emit('e2e:sender_key_ack', {
                roomId,
                receiverId: userId,
                keyId,
                timestamp: new Date().toISOString(),
            });

            callback?.({ success: true });

        } catch (error) {
            console.error('Error handling sender key ack:', error);
            callback?.({ success: false, error: 'Failed to acknowledge sender key' });
        }
    }
}

const e2eHandler = new E2EHandler();
export default e2eHandler;
