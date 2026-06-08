import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../index';
import { CallRepository } from '../../repositories/CallRepository';
import presenceHandler from './presenceHandler';
import Database from '../../config/database';

// In-memory active calls tracking (for busy check)
// Map<userId, callId>
const activeCalls = new Map<number, number>();

// Track ringing calls for timeout handling
// Map<callId, { timeout: NodeJS.Timeout, callerId: number, calleeId: number }>
const ringingCalls = new Map<number, { timeout: NodeJS.Timeout, callerId: number, calleeId: number }>();

class CallHandler {
    private io: Server | null = null;

    initialize(io: Server) {
        this.io = io;
    }

    // Call Initiation
    async handleInitiateCall(socket: AuthenticatedSocket, data: { calleeId: number; callType: 'voice' | 'video'; roomId?: number }) {
        try {
            const { userId, username } = socket;
            const { calleeId, callType, roomId } = data;

            // 1. Check if callee is busy
            if (activeCalls.has(calleeId)) {
                socket.emit('call:busy', { userId: calleeId });
                return;
            }

            // 2. Create call log (status: missed initially)
            const callLog = await CallRepository.createCallLog(
                roomId || null,
                userId,
                calleeId,
                callType
            );

            // 3. Mark caller as busy
            activeCalls.set(userId, callLog.id);

            // 4. Signal callee
            if (this.io) {
                this.io.to(`user:${calleeId}`).emit('call:ringing', {
                    callId: callLog.id,
                    callerId: userId,
                    callerName: username, // In real app, might want full profile
                    callType,
                    roomId
                });
            }

            // 5. Timeout for no answer (45s)
            const timeout = setTimeout(async () => {
                if (ringingCalls.has(callLog.id)) {
                    // Call was not answered in time
                    ringingCalls.delete(callLog.id);
                    activeCalls.delete(userId); // Caller no longer busy

                    // Notify caller
                    if (this.io) {
                        this.io.to(`user:${userId}`).emit('call:rejected', {
                            callId: callLog.id,
                            reason: 'timeout'
                        });
                        // Should we notify callee to stop ringing? Yes (call:ended or call:timeout)
                        this.io.to(`user:${calleeId}`).emit('call:ended', {
                            callId: callLog.id,
                            reason: 'missed'
                        });
                    }

                    // Log as missed
                    await CallRepository.updateCallStatus(callLog.id, 'missed');
                }
            }, 45000);

            ringingCalls.set(callLog.id, { timeout, callerId: userId, calleeId });

            // Broadcast caller as busy
            await presenceHandler.broadcastPresence(socket, 'busy');

        } catch (error) {
            console.error('Error initiating call:', error);
            socket.emit('error', { message: 'Failed to initiate call' });
        }
    }

    // Call Acceptance
    async handleAcceptCall(socket: AuthenticatedSocket, data: { callId: number; callerId: number }) {
        const { userId } = socket;
        const { callId, callerId } = data;

        // Mark callee as busy
        activeCalls.set(userId, callId);

        // Clear timeout
        if (ringingCalls.has(callId)) {
            clearTimeout(ringingCalls.get(callId)!.timeout);
            ringingCalls.delete(callId);
        }

        // Notify caller
        if (this.io) {
            this.io.to(`user:${callerId}`).emit('call:accepted', {
                callId,
                calleeId: userId
            });
        }

        // Broadcast callee as busy
        await presenceHandler.broadcastPresence(socket, 'busy');
    }

    // Call Rejection
    async handleRejectCall(socket: AuthenticatedSocket, data: { callId: number; callerId: number }) {
        const { userId } = socket;
        const { callId, callerId } = data;

        // Cleanup caller busy state
        activeCalls.delete(callerId);

        // Clear timeout
        if (ringingCalls.has(callId)) {
            clearTimeout(ringingCalls.get(callId)!.timeout);
            ringingCalls.delete(callId);
        }

        // Notify caller
        if (this.io) {
            this.io.to(`user:${callerId}`).emit('call:rejected', {
                callId,
                calleeId: userId
            });
        }

        // Update status for Caller (who was busy)
        try {
            const { rows } = await Database.query('SELECT username FROM users WHERE id = $1', [callerId]);
            if (rows.length > 0) {
                await presenceHandler.broadcastPresence(socket, 'online', {
                    userId: callerId,
                    username: rows[0].username
                });
            }
        } catch (error) {
            console.error('Failed to broadcast caller online status:', error);
        }

        // Update DB
        await CallRepository.updateCallStatus(callId, 'rejected');
    }

    // End Call
    async handleEndCall(socket: AuthenticatedSocket, data: { callId: number; otherUserId: number; duration?: number }) {
        const { userId } = socket;
        const { callId, otherUserId, duration } = data;

        // Cleanup busy states
        activeCalls.delete(userId);
        activeCalls.delete(otherUserId);

        // Clear timeout if ended during ringing (e.g. caller hung up)
        if (ringingCalls.has(callId)) {
            clearTimeout(ringingCalls.get(callId)!.timeout);
            ringingCalls.delete(callId);
        }

        // Notify other user
        if (this.io) {
            this.io.to(`user:${otherUserId}`).emit('call:ended', {
                callId,
                endedBy: userId
            });
        }

        // Broadcast current user (ender) as online
        await presenceHandler.broadcastPresence(socket, 'online');

        // Broadcast other user as online
        try {
            const { rows } = await Database.query('SELECT username FROM users WHERE id = $1', [otherUserId]);
            if (rows.length > 0) {
                await presenceHandler.broadcastPresence(socket, 'online', {
                    userId: otherUserId,
                    username: rows[0].username
                });
            }
        } catch (error) {
            console.error('Failed to broadcast other user online status:', error);
        }

        // Update DB
        if (duration) {
            await CallRepository.updateCallStatus(callId, 'completed', duration);
        }
    }

    // Group Call Logic
    async handleJoinGroupCall(socket: AuthenticatedSocket, roomId: number) {
        const { userId, username } = socket;
        const roomChannel = `call:room:${roomId}`;

        // Get existing participants in this room channel
        // Note: This relies on socket.io adapter logic.
        // In a clustered environment, we'd need Redis adapter capabilities to list sockets.
        // For single instance or sticky sessions, this works:
        const sockets = await this.io?.in(roomChannel).fetchSockets();

        // Check participant limit (Max 5)
        if (sockets && sockets.length >= 5) {
            socket.emit('call:error', { message: 'Room is full (Max 5 participants)' });
            return;
        }

        const participants = sockets?.map(s => {
            // We need to cast 's' to AuthenticatedSocket or access data safely
            const sAuth = s as unknown as AuthenticatedSocket;
            return {
                userId: sAuth.userId,
                username: sAuth.username
            };
        }).filter(p => p.userId !== userId) || [];

        // Join the channel
        socket.join(roomChannel);

        // Notify others
        socket.to(roomChannel).emit('call:new_peer', {
            userId,
            username
        });

        // Send existing participants to the joiner
        socket.emit('call:room_joined', {
            roomId,
            participants
        });

        // Mark user as busy? In group calls, maybe 'busy' is good, 
        // but they can be in multiple groups? For simplicity, yes busy.
        activeCalls.set(userId, roomId); // Store roomId as callId for tracking
        await presenceHandler.broadcastPresence(socket, 'busy');
    }

    async handleInviteToCall(socket: AuthenticatedSocket, data: { roomId: number; targetUserId: number }) {
        const { userId, username } = socket;
        const { roomId, targetUserId } = data;

        // Check if target is already in the room?
        const roomChannel = `call:room:${roomId}`;
        const sockets = await this.io?.in(roomChannel).fetchSockets();
        const isAlreadyIn = sockets?.some(s => (s as unknown as AuthenticatedSocket).userId === targetUserId);

        if (isAlreadyIn) {
            socket.emit('call:error', { message: 'User is already in the call' });
            return;
        }

        if (this.io) {
            this.io.to(`user:${targetUserId}`).emit('call:ringing', {
                callId: roomId, // Use roomId as callId for group invites so frontend knows where to join
                callerId: userId,
                callerName: username,
                callType: 'video',
                roomId: roomId,
                isGroupInvite: true
            });
        }
    }

    async handleLeaveGroupCall(socket: AuthenticatedSocket, roomId: number) {
        const { userId } = socket;
        const roomChannel = `call:room:${roomId}`;

        socket.leave(roomChannel);

        // Notify others
        socket.to(roomChannel).emit('call:peer_left', {
            userId
        });

        // Cleanup busy
        activeCalls.delete(userId);
        await presenceHandler.broadcastPresence(socket, 'online');
    }

    // WebRTC Signaling (Relay Only)
    handleSignal(socket: AuthenticatedSocket, data: { targetUserId: number; type: 'offer' | 'answer' | 'ice-candidate'; payload: any }) {
        const { userId } = socket;
        const { targetUserId, type, payload } = data;

        if (this.io) {
            this.io.to(`user:${targetUserId}`).emit('call:signal', {
                senderId: userId,
                type,
                payload
            });
        }
    }
}

export default new CallHandler();
