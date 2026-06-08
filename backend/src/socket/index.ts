import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server as HTTPServer } from 'http';
import { redisPubClient, redisSubClient } from '../config/redis';
import { authenticateToken } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimiter';
import messageHandler from './handlers/messageHandler';
import typingHandler from './handlers/typingHandler';
import presenceHandler from './handlers/presenceHandler';
import roomHandler from './handlers/roomHandler';
import pollHandler from './handlers/pollHandler';
import reactionHandler from './handlers/reactionHandler';
import callHandler from './handlers/callHandler';
import e2eHandler from './handlers/e2eHandler';
import constellationHandler from './handlers/constellationHandler';

export interface AuthenticatedSocket extends Socket {
    userId: number;
    username: string;
}

export function initializeSocket(httpServer: HTTPServer): Server {
    // Initialize Socket.io with CORS configuration
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
            credentials: true,
        },
        // Connection settings optimized for high-scale
        pingTimeout: 60000, // 60s before considering connection dead
        pingInterval: 25000, // Send ping every 25s
        upgradeTimeout: 10000,
        maxHttpBufferSize: 1e6, // 1MB max message size
        transports: ['websocket', 'polling'], // Prefer WebSocket
    });

    // ============================================
    // CRITICAL: Redis Adapter for Horizontal Scaling
    // ============================================
    // This enables multiple server instances to communicate
    // When User A on Server 1 sends a message to User B on Server 2,
    // the message goes through Redis Pub/Sub
    io.adapter(createAdapter(redisPubClient, redisSubClient));

    // Initialize CallHandler with IO instance
    callHandler.initialize(io);

    console.log('Socket.io Redis Adapter initialized - Horizontal scaling enabled');

    // ============================================
    // Middleware Stack
    // ============================================

    // 1. Authentication - Verify JWT token
    // 1. Authentication - Verify JWT token
    io.use(authenticateToken);

    // 2. Rate limiting - Prevent connection flooding (thundering herd protection)
    io.use(rateLimitMiddleware);

    // ============================================
    // Connection Handler
    // ============================================
    io.on('connection', async (socket: Socket) => {
        const authSocket = socket as AuthenticatedSocket;
        const { userId, username } = authSocket;

        console.log(`User connected: ${username} (ID: ${userId}, Socket: ${socket.id})`);

        try {
            // Track user session and mark as online
            await presenceHandler.handleConnection(authSocket);

            // ============================================
            // Event Handlers
            // ============================================

            // Room Management
            socket.on('room:join', (data) => roomHandler.handleJoinRoom(authSocket, data));
            socket.on('room:leave', (data) => roomHandler.handleLeaveRoom(authSocket, data));
            socket.on('space:create', (data, callback) => roomHandler.handleCreateSpace(authSocket, data, callback));
            socket.on('space:invite', (data, callback) => roomHandler.handleInviteToSpace(authSocket, data, callback));
            socket.on('space:leave', (data, callback) => roomHandler.handleLeaveSpace(authSocket, data, callback));
            socket.on('space:update', (data, callback) => roomHandler.handleUpdateSpace(authSocket, data, callback));
            socket.on('space:members', (data, callback) => roomHandler.handleGetSpaceMembers(authSocket, data, callback));
            socket.on('space:set_alias', (data, callback) => roomHandler.handleSetMemberAlias(authSocket, data, callback));

            // Chat Lock
            socket.on('room:lock', (data, callback) => roomHandler.handleLockChat(authSocket, data, callback));
            socket.on('room:get_locked', (data, callback) => roomHandler.handleGetLockedRooms(authSocket, data, callback));

            // Messaging
            socket.on('message:send', (data, callback) =>
                messageHandler.handleSendMessage(authSocket, data, callback)
            );
            socket.on('message:delivered', (data) =>
                messageHandler.handleMessageDelivered(authSocket, data)
            );
            socket.on('message:read', (data) =>
                messageHandler.handleMessageRead(authSocket, data)
            );
            socket.on('message:pin', (data, callback) =>
                messageHandler.handlePinMessage(authSocket, data, callback)
            );
            socket.on('message:unpin', (data, callback) =>
                messageHandler.handleUnpinMessage(authSocket, data, callback)
            );
            socket.on('message:get_pinned', (data, callback) =>
                messageHandler.handleGetPinnedMessages(authSocket, data, callback)
            );

            // Polls
            socket.on('poll:vote', (data) =>
                pollHandler.handleVote(authSocket, data)
            );

            // Reactions
            socket.on('reaction:toggle', (data, callback) =>
                reactionHandler.handleToggleReaction(authSocket, data, callback)
            );
            socket.on('reaction:get', (data, callback) =>
                reactionHandler.handleGetReactions(authSocket, data, callback)
            );

            // Typing Indicators
            socket.on('typing:start', (data) =>
                typingHandler.handleTypingStart(authSocket, data)
            );
            socket.on('typing:stop', (data) =>
                typingHandler.handleTypingStop(authSocket, data)
            );

            // Heartbeat for presence
            socket.on('heartbeat', () =>
                presenceHandler.handleHeartbeat(authSocket)
            );

            // ============================================
            // Call Events (WebRTC Signaling)
            // ============================================
            socket.on('call:initiate', (data) => callHandler.handleInitiateCall(authSocket, data));
            socket.on('call:accept', (data) => callHandler.handleAcceptCall(authSocket, data));
            socket.on('call:reject', (data) => callHandler.handleRejectCall(authSocket, data));
            socket.on('call:end', (data) => callHandler.handleEndCall(authSocket, data));
            socket.on('call:signal', (data) => callHandler.handleSignal(authSocket, data));

            // Group Calls
            socket.on('call:join_group', (data) => callHandler.handleJoinGroupCall(authSocket, data.roomId));
            socket.on('call:leave_group', (data) => callHandler.handleLeaveGroupCall(authSocket, data.roomId));
            socket.on('call:invite', (data) => callHandler.handleInviteToCall(authSocket, data));

            // ============================================
            // E2E Encryption Events
            // ============================================
            socket.on('e2e:distribute_sender_key', (data, callback) =>
                e2eHandler.handleSenderKeyDistribution(authSocket, data, callback)
            );
            socket.on('e2e:key_rotation', (data, callback) =>
                e2eHandler.handleKeyRotation(authSocket, data, callback)
            );
            socket.on('e2e:session_establish', (data, callback) =>
                e2eHandler.handleSessionEstablish(authSocket, data, callback)
            );
            socket.on('e2e:key_change', (data, callback) =>
                e2eHandler.handleKeyChange(authSocket, data, callback)
            );
            socket.on('e2e:request_sender_keys', (data, callback) =>
                e2eHandler.handleRequestSenderKeys(authSocket, data, callback)
            );
            socket.on('e2e:sender_key_ack', (data, callback) =>
                e2eHandler.handleSenderKeyAck(authSocket, data, callback)
            );

            // ============================================
            // Constellation Events (Message Collections)
            // ============================================
            socket.on('constellation:create', (data, callback) =>
                constellationHandler.handleCreateConstellation(authSocket, data, callback)
            );
            socket.on('constellation:list', (data, callback) =>
                constellationHandler.handleGetConstellations(authSocket, data, callback)
            );
            socket.on('constellation:update', (data, callback) =>
                constellationHandler.handleUpdateConstellation(authSocket, data, callback)
            );
            socket.on('constellation:delete', (data, callback) =>
                constellationHandler.handleDeleteConstellation(authSocket, data, callback)
            );
            socket.on('constellation:add_message', (data, callback) =>
                constellationHandler.handleAddMessage(authSocket, data, callback)
            );
            socket.on('constellation:remove_message', (data, callback) =>
                constellationHandler.handleRemoveMessage(authSocket, data, callback)
            );
            socket.on('constellation:get_messages', (data, callback) =>
                constellationHandler.handleGetMessages(authSocket, data, callback)
            );
            socket.on('constellation:for_message', (data, callback) =>
                constellationHandler.handleGetConstellationsForMessage(authSocket, data, callback)
            );

            // ============================================
            // Disconnection Handler
            // ============================================
            socket.on('disconnect', async (reason) => {
                console.log(`User disconnected: ${username} (Reason: ${reason})`);
                await presenceHandler.handleDisconnection(authSocket, reason);
            });

            // Error handling
            socket.on('error', (error) => {
                console.error(`Socket error for user ${username}:`, error);
            });

        } catch (error) {
            console.error('Error in connection handler:', error);
            socket.disconnect(true);
        }
    });

    // ============================================
    // Server-level Events
    // ============================================

    // Monitor adapter events (for debugging)
    if (process.env.NODE_ENV === 'development') {
        io.of('/').adapter.on('create-room', (room) => {
            console.log(`Room created: ${room}`);
        });

        io.of('/').adapter.on('join-room', (room, id) => {
            console.log(`Socket ${id} joined room: ${room}`);
        });

        io.of('/').adapter.on('leave-room', (room, id) => {
            console.log(`Socket ${id} left room: ${room}`);
        });
    }

    return io;
}

export default initializeSocket;
