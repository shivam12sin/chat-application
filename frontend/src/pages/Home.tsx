import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, Lock } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import MessageList from '../components/MessageList';
import Composer, { ReplyingTo } from '../components/Composer';
import Modal from '../components/Modal';
import AudioRecorder from '../components/AudioRecorder';
import { useToast } from '../hooks/useToast';
import { useMessageDelete } from '../hooks/useMessageDelete';
import { cn, SPACE_TONES } from '../utils/theme';
import { playNotificationSound, isQuietHoursActive } from '../utils/notification';
import socketService from '../services/socket';
import axios from 'axios';
import { uploadFile } from '../api/upload';
import { useNavigate } from 'react-router-dom';
import ToastContainer from '../components/Toast';
import ChromeButton from '../components/ChromeButton';

// E2E Encryption
import { useE2EInit } from '../hooks/useE2EInit';
import { e2eCryptoService } from '../crypto/E2ECryptoService';
import { prepareOutgoingMessage, prepareGroupMessage, processIncomingMessage } from '../services/e2eMessageService';

// Lazy load heavy components (code splitting)
const PollCreator = React.lazy(() => import('../components/PollCreator'));
const LocationPicker = React.lazy(() => import('../components/LocationPicker'));
const GifPicker = React.lazy(() => import('../components/GifPicker'));
const OrbitSearch = React.lazy(() => import('../components/OrbitSearch'));
const ChatSearch = React.lazy(() => import('../components/ChatSearch'));
const SpaceSettingsModal = React.lazy(() => import('../components/SpaceSettingsModal'));
const PinnedMessagesDrawer = React.lazy(() => import('../components/PinnedMessagesDrawer'));
const AddToConstellationMenu = React.lazy(() => import('../components/AddToConstellationMenu'));
const GroupCallScreen = React.lazy(() => import('../components/calls/GroupCallScreen'));
const IncomingCallModal = React.lazy(() => import('../components/calls/IncomingCallModal'));
const ForwardModal = React.lazy(() => import('../components/ForwardModal'));

import UndoToast from '../components/UndoToast';
import ScheduleModal from '../components/ScheduleModal';
import ChatLockModal from '../components/ChatLockModal';
import RoomOptionsMenu from '../components/RoomOptionsMenu';
import CallButton from '../components/calls/CallButton';
import webrtcService from '../services/webrtc';



// Loading fallback for lazy components
const LazyFallback = () => (
    <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 text-mono-muted animate-spin" />
    </div>
);


interface Room {
    id: number;
    name: string;
    room_type: 'direct' | 'group';
    last_message_content?: string;
    last_message_at?: string;
    last_sender_username?: string;
    isOnline?: boolean;
    unread?: number;
    other_user_id?: number;
    description?: string;
    tone?: string;
    settings?: { quietHours?: { start: string; end: string } };
}

// Helper to check if current time is within quiet hours
const isWithinQuietHours = (settings?: { quietHours?: { start: string; end: string } }): boolean => {
    if (!settings?.quietHours?.start || !settings?.quietHours?.end) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = settings.quietHours.start.split(':').map(Number);
    const [endH, endM] = settings.quietHours.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

interface Message {
    id: string;
    roomId: number;
    sender: {
        id: number;
        name: string;
        avatar?: string;
    };
    content: string;
    messageType?: 'text' | 'image' | 'video' | 'audio' | 'file' | 'poll' | 'location' | 'gif' | 'sticker' | 'youtube';
    metadata?: any;
    timestamp: Date | string;
    status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    isOwn: boolean;
    tempId?: string;
    reactions?: Array<{
        emoji: string;
        count: number;
        by: string[];
    }>;
}

function Home() {
    const navigate = useNavigate();
    const [isConnected, setIsConnected] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [token, setToken] = useState<string | null>(() => {
        const stored = localStorage.getItem('token');
        return stored && stored !== 'null' && stored !== 'undefined' ? stored : null;
    });

    // Data state
    const [rooms, setRooms] = useState<Room[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    // UI state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isPollCreatorOpen, setIsPollCreatorOpen] = useState(false);
    const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
    const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
    const [isOrbitSearchOpen, setIsOrbitSearchOpen] = useState(false);
    const [isAudioRecording, setIsAudioRecording] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [activeSearchQuery, setActiveSearchQuery] = useState('');
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleContent, setScheduleContent] = useState('');
    const [blockedUserIds, setBlockedUserIds] = useState<number[]>([]);
    const [mutedUserIds, setMutedUserIds] = useState<number[]>([]);
    const [mutedRoomIds, setMutedRoomIds] = useState<number[]>([]);
    const [isSpaceSettingsOpen, setIsSpaceSettingsOpen] = useState(false);
    const [isPinnedDrawerOpen, setIsPinnedDrawerOpen] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
    const [forwardingMessage, setForwardingMessage] = useState<{ id: string; content: string } | null>(null);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
    const [constellationTarget, setConstellationTarget] = useState<{
        messageId: string;
        roomId: number;
        position: { x: number; y: number };
    } | null>(null);

    // Chat Lock State
    const [lockedRoomIds, setLockedRoomIds] = useState<number[]>([]);
    const [unlockedSessionRooms, setUnlockedSessionRooms] = useState<number[]>([]);
    const [isLockModalOpen, setIsLockModalOpen] = useState(false);
    const [lockTargetRoom, setLockTargetRoom] = useState<{ id: string; name: string } | null>(null);
    const lockTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
    const prevSelectedRoomIdRef = useRef<number | null>(null);

    // Call State
    const [incomingCall, setIncomingCall] = useState<{ callId: number; callerId: number; callerName: string; callType: 'voice' | 'video'; roomId?: number } | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [activeCallType, setActiveCallType] = useState<'voice' | 'video'>('voice');
    const [groupCallVisible, setGroupCallVisible] = useState(false);




    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toasts, dismissToast, success, error: errorToast } = useToast();
    const { deleteForMe, deleteForEveryone, undoDelete, unhideForMe, pendingDelete, clearPendingDelete } = useMessageDelete();
    const [showUndoToast, setShowUndoToast] = useState(false);
    const [lastDeletedMessage, setLastDeletedMessage] = useState<Message | null>(null);
    const [lastDeleteMode, setLastDeleteMode] = useState<'me' | 'everyone'>('me');

    const API_URL = import.meta.env.VITE_API_URL || `http://localhost:3000/api`;

    // E2E Encryption State
    const [isE2EReady, setIsE2EReady] = useState(false);

    // Logout Helper
    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setToken(null);
        setCurrentUser(null);
        setIsConnected(false);
        setIsE2EReady(false);
        socketService.disconnect();
        navigate('/login');
    }, [navigate]);

    // E2E Initialization - auto-enable encryption by default
    useE2EInit({
        token,
        userId: currentUser?.id,
        isConnected,
        apiUrl: API_URL,
        onInitialized: async () => {
            console.log('E2E: Crypto services initialized');
            // Auto-enable E2E if not already enabled
            if (!e2eCryptoService.isEnabled()) {
                try {
                    await e2eCryptoService.enableE2E();
                    console.log('E2E: Encryption enabled automatically');
                } catch (err) {
                    console.error('E2E: Failed to enable automatically:', err);
                }
            }
            setIsE2EReady(true);
        },
        onError: (err) => {
            console.error('E2E: Initialization error:', err);
        },
    });

    // Socket connection
    useEffect(() => {
        const socket = socketService.getSocket();

        // Listeners for WebRTC events
        webrtcService.initialize(socket!); // Safe if we assume socket exists after connect, but strictly should check. socketService handles null internally.

        webrtcService.on('localStream', (stream) => setLocalStream(stream));
        // webrtcService.on('remoteStream') handled by GroupCallScreen
        // webrtcService.on('connectionState', (state) => setActiveCallStatus(state)); // Removed
        webrtcService.on('error', (err) => {
            console.error('WebRTC Error:', err);
            errorToast('Call connection failed');
            handleEndGroupCall();
        });

        // Socket listeners for signaling
        const onRinging = (data: any) => {
            if (!groupCallVisible) {
                setIncomingCall({
                    callId: data.callId,
                    callerId: data.callerId,
                    callerName: data.callerName,
                    callType: data.callType,
                    roomId: data.roomId
                });
            }
        };

        const onAccepted = async (_data: any) => {
            // User B accepted. They will join the room.
            // We just update status if needed.
            // setActiveCallStatus('connected'); // Removed
            // Remove 'startCall' logic - Mesh handles it via new_peer
        };

        const onRejected = () => {
            errorToast('Call rejected');
            handleEndGroupCall();
        };

        const onEnded = () => {
            handleEndGroupCall();
        };

        const onBusy = () => {
            errorToast('User is on another call');
            handleEndGroupCall();
        };

        socket?.on('call:ringing', onRinging);
        socket?.on('call:accepted', onAccepted);
        socket?.on('call:rejected', onRejected);
        socket?.on('call:ended', onEnded);
        socket?.on('call:busy', onBusy);

        return () => {
            // Cleanup
            socket?.off('call:ringing', onRinging);
            socket?.off('call:accepted', onAccepted);
            socket?.off('call:rejected', onRejected);
            socket?.off('call:ended', onEnded);
            socket?.off('call:busy', onBusy);
        };
    }, [activeCallType, groupCallVisible]); // Re-bind if these change

    const handleAcceptCall = async () => {
        if (!incomingCall) return;
        const socket = socketService.getSocket();
        const { callId, callerId, roomId } = incomingCall;

        setIncomingCall(null);

        // Join the room (Mesh)
        if (roomId) {
            handleJoinGroupCall(roomId);
        }

        // Notify caller
        socket?.emit('call:accept', { callId, callerId });
    };

    const handleRejectCall = () => {
        if (!incomingCall) return;
        const socket = socketService.getSocket();
        socket?.emit('call:reject', {
            callId: incomingCall.callId,
            callerId: incomingCall.callerId
        });
        setIncomingCall(null);
    };

    // New handler for starting calls (1:1 -> Mesh)
    const handleStartDirectCall = async (type: 'voice' | 'video') => {
        if (!selectedRoomId || !currentRoom?.other_user_id) return;

        setActiveCallType(type);

        // 1. Join Room
        handleJoinGroupCall(selectedRoomId);

        // 2. Ring User
        socketService.getSocket()?.emit('call:initiate', {
            calleeId: currentRoom.other_user_id,
            callType: type,
            roomId: selectedRoomId
        });
    };

    const handleJoinGroupCall = async (roomIdTarget?: number) => {
        const targetId = roomIdTarget || selectedRoomId;
        if (!targetId) return;

        setGroupCallVisible(true);
        try {
            // Ensure we join the group call
            await webrtcService.joinGroupCall(targetId);
        } catch (err) {
            console.error('Failed to join group call:', err);
            errorToast('Failed to join call');
            setGroupCallVisible(false);
        }
    };

    const handleEndGroupCall = async () => {
        await webrtcService.endCall();
        setGroupCallVisible(false);
    };

    // Socket connection and Auth
    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        const timeoutId = setTimeout(() => {
            if (!isConnected) {
                console.log('Connection timed out, logging out...');
                logout();
            }
        }, 5000);

        const socket = socketService.connect(token);

        if (socket.connected) {
            setIsConnected(true);
        }

        socket.on('connect', () => {
            setIsConnected(true);
            clearTimeout(timeoutId);
            console.log('Connected to chat server');
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            console.log('Disconnected from chat server');
        });

        socket.on('connect_error', (err) => {
            console.error('Connection error:', err);
            setIsConnected(false);
            if (err.message.includes('jwt') || err.message.includes('Authentication') || err.message.includes('token')) {
                logout();
            }
        });

        socket.on('auth_error', (err) => {
            console.error('Auth error:', err);
            logout();
        });

        // Decode token
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                setCurrentUser(JSON.parse(storedUser));
            } else {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setCurrentUser({
                    id: payload.userId,
                    username: payload.username,
                    displayName: payload.username // Fallback
                });
            }
        } catch (e) {
            console.error('Invalid token or user data', e);
            logout();
        }

        return () => {
            clearTimeout(timeoutId);
            socketService.disconnect();
        };
    }, [token, logout]);

    // Fetch rooms
    useEffect(() => {
        if (!token || !isConnected) return;

        const fetchRooms = async () => {
            try {
                const response = await axios.get(`${API_URL}/rooms`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setRooms(response.data.rooms);
            } catch (err) {
                console.error('Failed to fetch rooms', err);
                errorToast('Failed to load rooms');
            }
        };

        fetchRooms();
    }, [token, isConnected, API_URL, errorToast]);

    // Fetch blocked users
    // Fetch blocked and muted users
    useEffect(() => {
        if (!token || !isConnected) return;

        const fetchBlockedUsers = async () => {
            try {
                const response = await axios.get(`${API_URL}/blocked`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setBlockedUserIds(response.data.map((b: { blocked_id: number }) => b.blocked_id));
            } catch (err) {
                console.error('Failed to fetch blocked users', err);
            }
        };

        const fetchMutedList = async () => {
            try {
                const response = await axios.get(`${API_URL}/muted`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const mutedUsers = response.data
                    .filter((m: any) => m.muted_user_id)
                    .map((m: any) => m.muted_user_id);
                const mutedRooms = response.data
                    .filter((m: any) => m.muted_room_id)
                    .map((m: any) => m.muted_room_id);

                setMutedUserIds(mutedUsers);
                setMutedRoomIds(mutedRooms);
            } catch (err) {
                console.error('Failed to fetch muted list', err);
            }
        };

        fetchBlockedUsers();
        fetchMutedList();
    }, [token, isConnected, API_URL]);

    // Fetch messages
    useEffect(() => {
        if (!selectedRoomId || !token) return;

        const fetchMessages = async () => {
            setIsLoadingMessages(true);
            try {
                const response = await axios.get(`${API_URL}/messages/room/${selectedRoomId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const loadedMessages = response.data.messages.map((msg: any) => ({
                    id: msg.id,
                    roomId: msg.room_id,
                    sender: {
                        id: msg.sender_id,
                        name: msg.sender_username || 'Unknown',
                        avatar: msg.sender_avatar
                    },
                    content: msg.content,
                    messageType: msg.message_type,
                    metadata: msg.metadata,
                    timestamp: msg.created_at,
                    status: 'read',
                    isOwn: msg.sender_id === currentUser?.id,
                    reactions: []
                }));

                setMessages(loadedMessages);
            } catch (err) {
                console.error('Failed to fetch messages', err);
                errorToast('Failed to load messages');
            } finally {
                setIsLoadingMessages(false);
            }
        };

        fetchMessages();
        socketService.joinRoom(selectedRoomId);

        return () => {
            if (selectedRoomId) {
                socketService.leaveRoom(selectedRoomId);
            }
        };
    }, [selectedRoomId, token, currentUser, API_URL, errorToast]);

    // Socket listeners
    useEffect(() => {
        if (!socketService.getSocket()) return;

        const handleNewMessage = async (message: any) => {
            if (selectedRoomId && message.room_id === selectedRoomId) {
                // Process E2E decryption if message is encrypted
                let processedMessage = message;
                if (message.e2e && isE2EReady) {
                    try {
                        const decrypted = await processIncomingMessage({
                            id: message.id,
                            room_id: message.room_id,
                            sender_id: message.sender.id,
                            content: message.content,
                            message_type: message.message_type,
                            created_at: message.created_at,
                            sender_username: message.sender.username,
                            e2e: true,
                        });
                        processedMessage = {
                            ...message,
                            content: decrypted.content,
                            message_type: decrypted.message_type,
                        };
                    } catch (err) {
                        console.error('E2E decryption failed:', err);
                    }
                }

                const newMessage: Message = {
                    id: processedMessage.id,
                    roomId: processedMessage.room_id,
                    sender: {
                        id: processedMessage.sender.id,
                        name: processedMessage.sender.username,
                        avatar: processedMessage.sender.avatar
                    },
                    content: processedMessage.content,
                    messageType: processedMessage.message_type,
                    metadata: processedMessage.metadata,
                    timestamp: processedMessage.created_at,
                    status: 'delivered',
                    isOwn: processedMessage.sender.id === currentUser?.id,
                    reactions: []
                };

                setMessages(prev => {
                    if (prev.some(m => m.id === newMessage.id)) return prev;
                    return [...prev, newMessage];
                });
            }

            setRooms(prev => prev.map(room => {
                if (room.id === message.room_id) {
                    // Play notification sound if it's not our own message and not from a muted user/room and not in quiet hours
                    if (message.sender.id !== currentUser?.id) {
                        const isMutedUser = mutedUserIds.includes(message.sender.id);
                        const isMutedRoom = mutedRoomIds.includes(message.room_id);
                        const isQuiet = room.room_type === 'group' && isQuietHoursActive(room.settings);

                        if (!isMutedUser && !isMutedRoom) {
                            playNotificationSound(isQuiet);
                        }
                    }
                    return {
                        ...room,
                        last_message_content: message.message_type === 'text' ? message.content : `Sent a ${message.message_type}`,
                        last_message_at: message.created_at,
                        last_sender_username: message.sender.username
                    };
                }
                return room;
            }));
        };

        const handlePollUpdate = (data: any) => {
            if (selectedRoomId && data.roomId === selectedRoomId) {
                setMessages(prev => prev.map(msg => {
                    if (msg.id === data.pollId) {
                        return {
                            ...msg,
                            metadata: {
                                ...msg.metadata,
                                options: data.options
                            }
                        };
                    }
                    return msg;
                }));
            }
        }

        // Handle real-time reaction updates
        const handleReactionUpdate = (data: any) => {
            if (selectedRoomId && data.messageId) {
                setMessages(prev => prev.map(msg => {
                    if (msg.id === data.messageId) {
                        return {
                            ...msg,
                            reactions: data.reactions.map((r: any) => ({
                                emoji: r.emoji,
                                count: r.count,
                                by: r.users || []
                            }))
                        };
                    }
                    return msg;
                }));
            }
        };

        socketService.on('message:new', handleNewMessage);
        socketService.on('poll:updated', handlePollUpdate);
        socketService.on('reaction:update', handleReactionUpdate);

        return () => {
            socketService.off('message:new', handleNewMessage);
            socketService.off('poll:updated', handlePollUpdate);
            socketService.off('reaction:update', handleReactionUpdate);
        };
    }, [selectedRoomId, currentUser, isE2EReady]);

    // Chat Lock: Fetch locked rooms
    useEffect(() => {
        if (!isConnected) return;

        socketService.getLockedRooms(({ lockedRoomIds: ids }) => {
            if (ids) setLockedRoomIds(ids);
        });

        // For now, simple fetch on connect is good.
    }, [isConnected]);

    // Chat Lock: Timer Logic
    useEffect(() => {
        const currentId = selectedRoomId;
        const prevId = prevSelectedRoomIdRef.current;

        // If we left an unlocked room
        if (prevId && unlockedSessionRooms.includes(prevId) && prevId !== currentId) {
            // Clear existing timer if any
            if (lockTimersRef.current.has(prevId)) {
                clearTimeout(lockTimersRef.current.get(prevId)!);
            }

            // Set new timer (60s)
            const timeout = setTimeout(() => {
                setUnlockedSessionRooms(prev => prev.filter(id => id !== prevId));
                lockTimersRef.current.delete(prevId);
            }, 60000);

            lockTimersRef.current.set(prevId, timeout);
        }

        // If we entered an unlocked room
        if (currentId && unlockedSessionRooms.includes(currentId)) {
            if (lockTimersRef.current.has(currentId)) {
                clearTimeout(lockTimersRef.current.get(currentId)!);
                lockTimersRef.current.delete(currentId);
            }
        }

        prevSelectedRoomIdRef.current = currentId;
    }, [selectedRoomId, unlockedSessionRooms]);

    // Keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f' && selectedRoomId) {
                e.preventDefault();
                setIsSearchOpen(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRoomId]);


    const handleSendMessage = useCallback(
        async (content: string, type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'poll' | 'location' | 'gif' | 'sticker' | 'youtube' = 'text', metadata?: any, replyToId?: string) => {
            if (!selectedRoomId || !currentUser) return;

            const tempId = Date.now().toString();

            // Include replyTo info in metadata if present (with senderName and content for display)
            const messageMetadata = replyToId
                ? { ...metadata, replyTo: { messageId: replyToId, senderName: replyingTo?.senderName, content: replyingTo?.content } }
                : metadata;

            const optimisticMessage: Message = {
                id: tempId,
                roomId: selectedRoomId,
                sender: { id: currentUser.id, name: currentUser.username },
                content,
                messageType: type,
                metadata: messageMetadata,
                timestamp: new Date(),
                status: 'sending',
                isOwn: true,
                tempId
            };

            setMessages(prev => [...prev, optimisticMessage]);

            // E2E Encryption for text messages
            if (type === 'text' && isE2EReady) {
                try {
                    const message = {
                        roomId: selectedRoomId,
                        content,
                        messageType: type,
                        tempId,
                    };

                    // Determine if DM or group (compute inline to avoid variable order issues)
                    const room = rooms.find(r => r.id === selectedRoomId);
                    const isDM = room?.room_type === 'direct';
                    const recipientUserId = room?.other_user_id;

                    if (isDM && recipientUserId) {
                        // Encrypt for DM using X3DH + Double Ratchet
                        const { payload, isEncrypted } = await prepareOutgoingMessage(
                            message,
                            recipientUserId,
                            selectedRoomId
                        );

                        if (isEncrypted && 'e2e' in payload) {
                            // Send encrypted message
                            socketService.sendEncryptedMessage(
                                selectedRoomId,
                                payload.content,
                                tempId,
                                (response: any) => {
                                    if (response.success) {
                                        setMessages(prev => prev.map(msg =>
                                            msg.tempId === tempId
                                                ? { ...msg, id: response.message.id, status: 'sent', tempId: undefined }
                                                : msg
                                        ));
                                    } else {
                                        setMessages(prev => prev.map(msg =>
                                            msg.tempId === tempId
                                                ? { ...msg, status: 'failed' }
                                                : msg
                                        ));
                                        errorToast(response.error || 'Failed to send message');
                                    }
                                },
                                payload.metadata
                            );
                            return;
                        }
                    } else if (room?.room_type === 'group') {
                        // Encrypt for group using Sender Keys protocol
                        // For now, we need member IDs - we'll use an empty array which triggers initialization
                        const { payload, isEncrypted } = await prepareGroupMessage(
                            message,
                            [], // Member IDs are fetched internally by GroupE2EService
                            selectedRoomId
                        );

                        if (isEncrypted && 'e2e' in payload) {
                            // Send encrypted group message
                            socketService.sendEncryptedMessage(
                                selectedRoomId,
                                payload.content,
                                tempId,
                                (response: any) => {
                                    if (response.success) {
                                        setMessages(prev => prev.map(msg =>
                                            msg.tempId === tempId
                                                ? { ...msg, id: response.message.id, status: 'sent', tempId: undefined }
                                                : msg
                                        ));
                                    } else {
                                        setMessages(prev => prev.map(msg =>
                                            msg.tempId === tempId
                                                ? { ...msg, status: 'failed' }
                                                : msg
                                        ));
                                        errorToast(response.error || 'Failed to send message');
                                    }
                                },
                                payload.metadata
                            );
                            return;
                        }
                    }
                } catch (err) {
                    console.error('E2E encryption failed, falling back to plaintext:', err);
                }
            }

            // Fallback: Send plaintext (or non-text message types)
            socketService.emit('message:send', {
                roomId: selectedRoomId,
                content,
                messageType: type,
                metadata,
                tempId
            }, (response: any) => {
                if (response.success) {
                    setMessages(prev => prev.map(msg =>
                        msg.tempId === tempId
                            ? { ...msg, id: response.message.id, status: 'sent', tempId: undefined }
                            : msg
                    ));
                } else {
                    setMessages(prev => prev.map(msg =>
                        msg.tempId === tempId
                            ? { ...msg, status: 'failed' }
                            : msg
                    ));
                    errorToast(response.error || 'Failed to send message');
                }
            });
        },
        [selectedRoomId, currentUser, rooms, isE2EReady, errorToast, replyingTo]
    );

    const handleAttachmentSelect = (type: 'image' | 'video' | 'file' | 'poll' | 'location' | 'gif' | 'music' | 'schedule') => {
        switch (type) {
            case 'schedule':
                setIsScheduleModalOpen(true);
                break;
            case 'poll':
                setIsPollCreatorOpen(true);
                break;
            case 'location':
                setIsLocationPickerOpen(true);
                break;
            case 'gif':
                setIsGifPickerOpen(true);
                break;
            case 'music':
                setIsOrbitSearchOpen(true);
                break;
            case 'image':
            case 'video':
            case 'file':
                if (fileInputRef.current) {
                    fileInputRef.current.accept = type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : '*/*';
                    fileInputRef.current.click();
                }
                break;
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const uploaded = await uploadFile(file);
            let type: 'image' | 'video' | 'file' | 'audio' = 'file';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            else if (file.type.startsWith('audio/')) type = 'audio';

            handleSendMessage(uploaded.url, type, {
                url: uploaded.url,
                originalName: uploaded.filename,
                mimetype: uploaded.mimetype,
                size: uploaded.size
            });
        } catch (err: any) {
            console.error('Upload failed', err);
            const errorMessage = err.response?.data?.error || err.message || 'Failed to upload file';
            errorToast(errorMessage);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handlePollSubmit = (question: string, options: string[], allowMultiple: boolean) => {
        handleSendMessage('Poll: ' + question, 'poll', {
            question,
            options: options.map(opt => ({ text: opt, votes: 0 })),
            allowMultiple
        });
    };

    const handleLocationSelect = (location: { lat: number; lng: number }) => {
        handleSendMessage('Shared Location', 'location', location);
        setIsLocationPickerOpen(false);
    };

    const handleGifSelect = (gif: any) => {
        handleSendMessage(gif.images.fixed_height.url, 'gif', {
            url: gif.images.fixed_height.url,
            width: gif.images.fixed_height.width,
            height: gif.images.fixed_height.height
        });
        setIsGifPickerOpen(false);
    };

    const handleOrbitSelect = (video: { videoId: string, title: string, thumbnail: string, channel: string }) => {
        handleSendMessage(video.title, 'youtube', {
            videoId: video.videoId,
            title: video.title,
            thumbnail: video.thumbnail,
            channelTitle: video.channel
        });
        setIsOrbitSearchOpen(false);
    };

    const handleAudioComplete = async (audioBlob: Blob) => {
        const file = new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' });
        try {
            const uploaded = await uploadFile(file);
            handleSendMessage(uploaded.url, 'audio', {
                url: uploaded.url,
                originalName: 'Voice Note',
                mimetype: 'audio/webm',
                size: file.size
            });
            setIsAudioRecording(false);
        } catch (err) {
            console.error('Audio upload failed', err);
            errorToast('Failed to send voice note');
        }
    };

    const handlePollVote = (pollId: string, optionIndex: number) => {
        socketService.emit('poll:vote', { pollId, optionIndex });
    };

    // Handle emoji reaction toggle
    const handleReaction = useCallback((messageId: string, emoji: string) => {
        if (!selectedRoomId) return;

        // Optimistically update UI
        setMessages(prev => prev.map(msg => {
            if (msg.id === messageId) {
                const existingReactions = msg.reactions || [];
                const existingReaction = existingReactions.find(r => r.emoji === emoji);

                let newReactions;
                if (existingReaction) {
                    // Toggle off if user already reacted (optimistic)
                    if (existingReaction.count === 1) {
                        newReactions = existingReactions.filter(r => r.emoji !== emoji);
                    } else {
                        newReactions = existingReactions.map(r =>
                            r.emoji === emoji ? { ...r, count: r.count - 1 } : r
                        );
                    }
                } else {
                    // Add new reaction
                    newReactions = [...existingReactions, { emoji, count: 1, by: [currentUser?.username || ''] }];
                }

                return { ...msg, reactions: newReactions };
            }
            return msg;
        }));

        // Send to server
        socketService.toggleReaction(messageId, selectedRoomId, emoji, (response) => {
            if (!response.success) {
                errorToast(response.error || 'Failed to update reaction');
                // TODO: Could revert optimistic update here if needed
            }
        });
    }, [selectedRoomId, currentUser, errorToast]);



    const handleRoomSelect = useCallback((roomId: string) => {
        const id = parseInt(roomId);
        const isLocked = lockedRoomIds.includes(id);
        const isUnlocked = unlockedSessionRooms.includes(id);

        if (isLocked && !isUnlocked) {
            const room = rooms.find(r => r.id === id);
            setLockTargetRoom({ id: roomId, name: room?.name || 'Chat' });
            setIsLockModalOpen(true);
        } else {
            setSelectedRoomId(id);
            setIsMobileMenuOpen(false);
        }
    }, [lockedRoomIds, unlockedSessionRooms, rooms]);

    const handleUnlockChat = async (password: string): Promise<boolean> => {
        try {
            const response = await axios.post(`${API_URL}/auth/verify-password`, { password }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.valid) {
                if (lockTargetRoom) {
                    const roomId = parseInt(lockTargetRoom.id);
                    setUnlockedSessionRooms(prev => [...prev, roomId]);
                    setSelectedRoomId(roomId);
                    // Clear any running timer for this room immediately
                    if (lockTimersRef.current.has(roomId)) {
                        clearTimeout(lockTimersRef.current.get(roomId)!);
                        lockTimersRef.current.delete(roomId);
                    }
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Unlock failed', error);
            return false;
        }
    };

    const handleLockToggled = (locked: boolean) => {
        if (!selectedRoomId) return;

        socketService.lockChat(selectedRoomId, locked, (response) => {
            if (response.error) {
                errorToast('Failed to updates lock status');
            } else {
                if (locked) {
                    setLockedRoomIds(prev => [...prev, selectedRoomId]);
                    // Automatically unlock for current session so user doesn't get kicked out immediately
                    setUnlockedSessionRooms(prev => [...prev, selectedRoomId]);
                    success('Chat locked');
                } else {
                    setLockedRoomIds(prev => prev.filter(id => id !== selectedRoomId));
                    setUnlockedSessionRooms(prev => prev.filter(id => id !== selectedRoomId));
                    success('Chat unlocked');
                }
            }
        });
    };

    const handleScheduleMessage = async (date: Date) => {
        if (!selectedRoomId || !scheduleContent) return;

        setIsScheduling(true);
        try {
            await axios.post(`${API_URL}/messages/schedule`, {
                roomId: selectedRoomId,
                content: scheduleContent,
                scheduledAt: date.toISOString()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            success(`Message scheduled for ${date.toLocaleString()}`);
            setIsScheduleModalOpen(false);
            setScheduleContent('');
        } catch (err) {
            console.error('Schedule error:', err);
            errorToast('Failed to schedule message');
        } finally {
            setIsScheduling(false);
        }
    };



    const createRoom = async (name: string) => {
        try {
            const response = await axios.post(`${API_URL}/rooms`, {
                name,
                roomType: 'group',
                members: []
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const newRoom = response.data.room;
            setRooms(prev => [newRoom, ...prev]);
            setSelectedRoomId(newRoom.id);
            setIsModalOpen(false);
            success('Room created successfully!');
        } catch (err) {
            console.error('Create room error:', err);
            errorToast('Failed to create room');
        }
    };

    if (!isConnected || !currentUser) {
        return (
            <div className="h-screen text-mono-text flex items-center justify-center flex-col gap-4">
                <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-3 h-3 rounded-full bg-mono-muted/40"
                        />
                    ))}
                </div>
                <p className="text-mono-muted">Connecting...</p>
                <ChromeButton
                    onClick={logout}
                    className="mt-4 px-4 py-2 text-sm"
                >
                    Cancel
                </ChromeButton>
            </div>
        );
    }

    const currentRoom = rooms.find(r => r.id === selectedRoomId);

    const sidebarRooms = rooms.map(r => ({
        id: r.id.toString(),
        name: r.name || 'Direct Message',
        unread: r.unread || 0,
        snippet: r.last_message_content,
        timestamp: r.last_message_at ? new Date(r.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
        isOnline: r.isOnline
    }));

    return (
        <div className="h-screen w-full flex overflow-hidden">
            {/* Sidebar - Collapsible with motion */}
            <motion.div
                initial={{ width: 320, opacity: 1 }}
                animate={{
                    width: isSidebarOpen ? 320 : 0,
                    opacity: isSidebarOpen ? 1 : 0
                }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                    'hidden md:flex flex-shrink-0 h-full overflow-hidden',
                    'bg-mono-bg/40 backdrop-blur-glass border-r border-mono-glass-border',
                    'flex-col'
                )}
            >
                <div className="w-80 h-full">
                    <Sidebar
                        rooms={sidebarRooms}
                        selectedRoomId={selectedRoomId?.toString()}
                        lockedRoomIds={lockedRoomIds}
                        currentUser={currentUser}
                        onRoomSelect={handleRoomSelect}
                        onLockedRoomClick={(roomId, name) => {
                            setLockTargetRoom({ id: roomId, name });
                            setIsLockModalOpen(true);
                        }}
                        className="w-full md:w-[320px] flex-shrink-0"
                        onToggleSidebar={() => setIsSidebarOpen(false)}
                        onSpaceCreated={(space) => {
                            // Add newly created space to rooms list
                            setRooms(prev => [{
                                id: space.id,
                                name: space.name,
                                avatar: space.avatar,
                                unread: 0,
                                room_type: 'group',
                                tone: space.tone,
                                settings: space.settings
                            }, ...prev]);
                            setSelectedRoomId(space.id);
                        }}
                        onUpdateProfile={(updates) => {
                            // Optimistically update current user
                            setCurrentUser((prev: any) => ({ ...prev, ...updates }));
                            // Update user in local storage if it exists
                            const userStr = localStorage.getItem('user');
                            if (userStr) {
                                try {
                                    const user = JSON.parse(userStr);
                                    localStorage.setItem('user', JSON.stringify({ ...user, ...updates }));
                                } catch (e) {
                                    console.error('Failed to update local storage user', e);
                                }
                            }
                        }}
                    />
                </div>
            </motion.div>

            {/* Chat Area - Apply dimmed effect during quiet hours */}
            <div className={cn(
                "flex-1 flex flex-col min-w-0 h-full",
                currentRoom?.room_type === 'group' && isWithinQuietHours(currentRoom?.settings) && "opacity-60 saturate-50"
            )}>
                <div
                    className={cn(
                        'flex-shrink-0 h-16 px-4 py-3',
                        'border-b border-mono-glass-border',
                        'flex items-center justify-between gap-2',
                        'bg-mono-bg/40 backdrop-blur-glass'
                    )}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Toggle Sidebar Button (Only visible when sidebar is closed) */}
                        {!isSidebarOpen && (
                            <ChromeButton
                                onClick={() => setIsSidebarOpen(true)}
                                variant="circle"
                                className="hidden md:flex p-2 min-h-[40px] min-w-[40px] items-center justify-center text-mono-text mr-2 animate-fade-in"
                                title="Open Sidebar"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                            </ChromeButton>
                        )}

                        {/* Mobile Menu Toggle */}
                        <ChromeButton
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className={cn(
                                'md:hidden p-2 rounded-glass',
                                'bg-mono-surface hover:bg-mono-surface/80',
                                'border border-mono-glass-border hover:border-mono-glass-highlight',
                                'text-mono-text hover:text-mono-text',
                                'min-h-[40px] min-w-[40px] flex items-center justify-center'
                            )}
                            aria-label="Toggle menu"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </ChromeButton>

                        {/* Room Info */}
                        {currentRoom && (
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="min-w-0">
                                    <h2 className="text-base font-semibold text-mono-text truncate flex items-center gap-2">
                                        {currentRoom.name}
                                        {/* E2E Lock Icon */}
                                        {isE2EReady && (
                                            <span
                                                className="inline-flex items-center text-green-400/80"
                                                title="End-to-end encrypted"
                                            >
                                                <Lock className="w-3.5 h-3.5" />
                                            </span>
                                        )}
                                        {currentRoom.room_type === 'group' && currentRoom.tone && SPACE_TONES[currentRoom.tone] && (
                                            <span className={cn(
                                                "px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-sm border",
                                                SPACE_TONES[currentRoom.tone].color,
                                                SPACE_TONES[currentRoom.tone].border,
                                                SPACE_TONES[currentRoom.tone].bg
                                            )}>
                                                {SPACE_TONES[currentRoom.tone].label}
                                            </span>
                                        )}
                                    </h2>
                                    <p className="text-xs text-mono-muted truncate">
                                        {currentRoom.room_type === 'group' && currentRoom.description
                                            ? currentRoom.description
                                            : (currentRoom.isOnline ? 'Online' : 'Offline')}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Header Actions */}
                    {currentRoom && (
                        <div className="flex gap-2 flex-shrink-0">
                            {/* Call Buttons - DIRECT ONLY as per Phase 12 requirements */}
                            {currentRoom.room_type === 'direct' && (
                                <div className="flex gap-1 bg-zinc-800/50 rounded-full px-2 py-1 border border-white/5 items-center justify-center">
                                    <CallButton
                                        type="voice"
                                        onCallStart={handleStartDirectCall}
                                    />
                                    <CallButton
                                        type="video"
                                        onCallStart={handleStartDirectCall}
                                    />
                                </div>
                            )}


                            {/* Pinned Messages - ALL CHAT TYPES */}
                            <ChromeButton
                                variant="circle"
                                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-amber-400/70 hover:text-amber-400"
                                aria-label="Pinned Messages"
                                onClick={() => setIsPinnedDrawerOpen(true)}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                            </ChromeButton>

                            {/* Space Settings - GROUP ONLY */}
                            {currentRoom.room_type === 'group' && (
                                <>
                                    {/* Settings Gear */}
                                    <ChromeButton
                                        variant="circle"
                                        className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-mono-muted hover:text-mono-text"
                                        aria-label="Space Settings"
                                        onClick={() => setIsSpaceSettingsOpen(true)}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </ChromeButton>
                                </>
                            )}


                            <ChromeButton
                                variant="circle"
                                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-mono-muted hover:text-mono-text"
                                aria-label="Search"
                                onClick={() => setIsSearchOpen(true)}
                            >
                                <Search className="w-5 h-5" />
                            </ChromeButton>
                            <RoomOptionsMenu
                                roomId={selectedRoomId!}
                                userId={currentRoom?.other_user_id}
                                roomName={currentRoom?.name || 'Chat'}
                                isMuted={selectedRoomId ? mutedRoomIds.includes(selectedRoomId) : false}
                                isLocked={selectedRoomId ? lockedRoomIds.includes(selectedRoomId) : false}
                                token={token!}
                                onMuteChange={(muted) => {
                                    if (selectedRoomId) {
                                        if (muted) {
                                            setMutedRoomIds(prev => [...prev, selectedRoomId]);
                                        } else {
                                            setMutedRoomIds(prev => prev.filter(id => id !== selectedRoomId));
                                        }
                                    }
                                }}
                                onLockChange={handleLockToggled}
                                onBlockChange={(blocked) => {
                                    if (currentRoom?.other_user_id) {
                                        if (blocked) {
                                            setBlockedUserIds(prev => [...prev, currentRoom.other_user_id!]);
                                        } else {
                                            setBlockedUserIds(prev => prev.filter(id => id !== currentRoom.other_user_id));
                                        }
                                    }
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-hidden relative">
                    {/* Chat Search Overlay */}
                    {selectedRoomId && (
                        <Suspense fallback={null}>
                            <ChatSearch
                                roomId={selectedRoomId}
                                isOpen={isSearchOpen}
                                onClose={() => {
                                    setIsSearchOpen(false);
                                    setActiveSearchQuery('');
                                }}
                                onQueryChange={setActiveSearchQuery}
                                onNavigateToMessage={(messageId) => {
                                    // Scroll to message and briefly highlight
                                    const element = document.getElementById(`message-${messageId}`);
                                    if (element) {
                                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        element.classList.add('bg-mono-surface-2/50');
                                        setTimeout(() => element.classList.remove('bg-mono-surface-2/50'), 2000);
                                    }
                                }}
                            />
                        </Suspense>
                    )}

                    <MessageList
                        messages={messages
                            .filter(m => !blockedUserIds.includes(m.sender.id)) // Filter blocked users
                            .map(m => ({
                                ...m,
                                sender: {
                                    ...m.sender,
                                    id: m.sender.id.toString()
                                },
                                roomId: m.roomId.toString()
                            }))}
                        isLoading={isLoadingMessages}
                        roomId={selectedRoomId || undefined}
                        roomName={currentRoom?.name}
                        className="h-full"
                        searchQuery={activeSearchQuery}
                        onPollVote={handlePollVote}
                        onReaction={handleReaction}
                        onDelete={async (messageId: string, mode: 'me' | 'everyone') => {
                            if (!selectedRoomId) return;
                            try {
                                // Store message before deleting (for undo)
                                const msgToDelete = messages.find(m => m.id === messageId);
                                if (msgToDelete) {
                                    setLastDeletedMessage(msgToDelete);
                                    setLastDeleteMode(mode);
                                }

                                if (mode === 'me') {
                                    await deleteForMe(messageId, selectedRoomId);
                                    setMessages(prev => prev.filter(m => m.id !== messageId));
                                    setShowUndoToast(true);
                                } else {
                                    await deleteForEveryone(messageId, selectedRoomId);
                                    setMessages(prev => prev.filter(m => m.id !== messageId));
                                    setShowUndoToast(true);
                                    // Socket will broadcast to others
                                    socketService.emit('message:delete', { messageId, roomId: selectedRoomId, mode: 'everyone' });
                                }
                            } catch (err) {
                                errorToast('Failed to delete message');
                            }
                        }}
                        onPin={(messageId: string) => {
                            if (!selectedRoomId) return;
                            socketService.pinMessage(messageId, selectedRoomId, (response) => {
                                if (response.error) {
                                    errorToast(response.error);
                                } else {
                                    success('Message pinned');
                                }
                            });
                        }}
                        onConstellation={(messageId: string, roomId: number) => {
                            const element = document.getElementById(`message-${messageId}`);
                            const rect = element?.getBoundingClientRect();
                            setConstellationTarget({
                                messageId,
                                roomId,
                                position: {
                                    x: Math.min(rect?.right || 300, window.innerWidth - 280),
                                    y: Math.min(rect?.top || 200, window.innerHeight - 300)
                                }
                            });
                        }}
                        onReply={(messageId: string, senderName: string, content: string) => {
                            setReplyingTo({ messageId, senderName, content });
                        }}
                        onForward={(messageId: string, content: string) => {
                            setForwardingMessage({ id: messageId, content });
                        }}
                        onSelect={(messageId: string) => {
                            // Enter select mode and select this message
                            setIsSelectMode(true);
                            setSelectedMessageIds([messageId]);
                        }}
                        isSelectMode={isSelectMode}
                        selectedMessageIds={selectedMessageIds}
                        onToggleSelect={(messageId: string) => {
                            setSelectedMessageIds(prev =>
                                prev.includes(messageId)
                                    ? prev.filter(id => id !== messageId)
                                    : [...prev, messageId]
                            );
                        }}
                    />

                    {/* Audio Recorder Overlay */}
                    {isAudioRecording && (
                        <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-center">
                            <AudioRecorder
                                onRecordingComplete={handleAudioComplete}
                                onCancel={() => setIsAudioRecording(false)}
                            />
                        </div>
                    )}
                </div>

                {/* Composer OR Select Mode Action Bar */}
                {currentRoom && !isAudioRecording && (
                    isSelectMode ? (
                        // Selection Action Bar
                        <div className="flex-shrink-0 p-4 bg-mono-bg border-t border-zinc-700/50">
                            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 px-4 py-3 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700/50 rounded-xl">
                                <span className="text-sm text-white font-medium">
                                    {selectedMessageIds.length} message{selectedMessageIds.length !== 1 && 's'} selected
                                </span>
                                <div className="flex gap-2 items-center">
                                    {/* Forward Button */}
                                    <ChromeButton
                                        onClick={() => {
                                            // Get first selected message content for preview
                                            const firstMsg = messages.find(m => selectedMessageIds.includes(m.id));
                                            const content = firstMsg
                                                ? `${selectedMessageIds.length > 1 ? `[${selectedMessageIds.length} messages]` : firstMsg.content}`
                                                : '';
                                            setForwardingMessage({ id: selectedMessageIds.join(','), content });
                                            setIsSelectMode(false);
                                            setSelectedMessageIds([]);
                                        }}
                                        variant="circle"
                                        className="text-blue-400 hover:text-blue-300"
                                        disabled={selectedMessageIds.length === 0}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                                        </svg>
                                    </ChromeButton>
                                    {/* Delete Button */}
                                    <ChromeButton
                                        onClick={async () => {
                                            // Delete selected messages
                                            for (const msgId of selectedMessageIds) {
                                                await deleteForMe(msgId, selectedRoomId!);
                                                setMessages(prev => prev.filter(m => m.id !== msgId));
                                            }
                                            success(`Deleted ${selectedMessageIds.length} message${selectedMessageIds.length !== 1 ? 's' : ''}`);
                                            setIsSelectMode(false);
                                            setSelectedMessageIds([]);
                                        }}
                                        variant="circle"
                                        className="text-red-400 hover:text-red-300"
                                        disabled={selectedMessageIds.length === 0}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </ChromeButton>
                                    {/* Cancel Button */}
                                    <ChromeButton
                                        onClick={() => {
                                            setIsSelectMode(false);
                                            setSelectedMessageIds([]);
                                        }}
                                        className="px-4 py-2 text-sm text-zinc-300 hover:text-white"
                                    >
                                        Cancel
                                    </ChromeButton>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Composer
                            onSendMessage={(content, replyToId) => {
                                handleSendMessage(content, 'text', undefined, replyToId);
                            }}
                            onContentChange={(content) => setScheduleContent(content)}
                            onAttachmentSelect={handleAttachmentSelect}
                            placeholder="Type a message..."
                            isSidebarOpen={isSidebarOpen}
                            replyingTo={replyingTo}
                            onCancelReply={() => setReplyingTo(null)}
                        />
                    )
                )}
            </div>

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
            />

            {/* Modals - Lazy loaded with Suspense */}
            <Suspense fallback={<LazyFallback />}>
                <PollCreator
                    isOpen={isPollCreatorOpen}
                    onClose={() => setIsPollCreatorOpen(false)}
                    onSubmit={handlePollSubmit}
                />
            </Suspense>

            {isLocationPickerOpen && (
                <Suspense fallback={<LazyFallback />}>
                    <LocationPicker
                        onLocationSelect={handleLocationSelect}
                        onCancel={() => setIsLocationPickerOpen(false)}
                    />
                </Suspense>
            )}

            {isGifPickerOpen && (
                <Suspense fallback={<LazyFallback />}>
                    <GifPicker
                        onSelect={handleGifSelect}
                        onClose={() => setIsGifPickerOpen(false)}
                    />
                </Suspense>
            )}

            {isOrbitSearchOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
                    onClick={() => setIsOrbitSearchOpen(false)}
                >
                    <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl h-[70vh]">
                        <Suspense fallback={<LazyFallback />}>
                            <OrbitSearch
                                onSelect={handleOrbitSelect}
                                onClose={() => setIsOrbitSearchOpen(false)}
                            />
                        </Suspense>
                    </div>
                </div>
            )}

            {isMobileMenuOpen && (
                <div
                    className={cn(
                        'fixed inset-0 z-40 md:hidden',
                        'bg-mono-bg/80 backdrop-blur-glass',
                        'animate-fade-up'
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                >
                    <div
                        className={cn(
                            'absolute inset-y-0 left-0 w-80',
                            'bg-mono-bg border-r border-mono-glass-border',
                            'shadow-lg',
                            'animate-slide-right'
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Sidebar
                            rooms={sidebarRooms}
                            lockedRoomIds={lockedRoomIds}
                            selectedRoomId={selectedRoomId?.toString()}
                            onRoomSelect={handleRoomSelect}
                            onLockedRoomClick={(roomId, name) => {
                                setLockTargetRoom({ id: roomId, name });
                                setIsLockModalOpen(true);
                            }}
                            onSpaceCreated={(space) => {
                                setRooms(prev => [{
                                    id: space.id,
                                    name: space.name,
                                    room_type: 'group',
                                    description: space.description,
                                    tone: space.tone,
                                    settings: space.settings,
                                }, ...prev]);
                                setSelectedRoomId(space.id);
                                setIsMobileMenuOpen(false);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Chat Lock Modal */}
            <ChatLockModal
                isOpen={isLockModalOpen}
                onClose={() => {
                    setIsLockModalOpen(false);
                    setLockTargetRoom(null);
                }}
                onUnlock={handleUnlockChat}
                roomName={lockTargetRoom?.name || 'Chat'}
            />

            <Modal
                isOpen={isModalOpen}
                title="Create New Room"
                onClose={() => setIsModalOpen(false)}
                onConfirm={() => {
                    const input = document.getElementById('new-room-name') as HTMLInputElement;
                    if (input && input.value) {
                        createRoom(input.value);
                    }
                }}
                confirmText="Create"
                contentClassName="space-y-4"
            >
                <input
                    id="new-room-name"
                    type="text"
                    placeholder="Room Name"
                    className="input-glass w-full"
                    autoFocus
                />
            </Modal>
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
            <UndoToast
                isVisible={showUndoToast && !!lastDeletedMessage}
                duration={7000}
                onUndo={async () => {
                    if (lastDeletedMessage) {
                        let restored = false;
                        if (lastDeleteMode === 'me') {
                            // Undo Delete for Me - unhide the message
                            restored = await unhideForMe(lastDeletedMessage.id);
                        } else if (pendingDelete) {
                            // Undo Delete for Everyone - use undo token
                            restored = await undoDelete(pendingDelete.undoToken);
                        }

                        if (restored) {
                            // Re-add message to local state
                            setMessages(prev => [...prev, lastDeletedMessage].sort((a, b) =>
                                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                            ));
                            success('Message restored');
                            setLastDeletedMessage(null);
                        }
                    }
                    setShowUndoToast(false);
                }}
                onExpire={() => {
                    setShowUndoToast(false);
                    clearPendingDelete();
                    setLastDeletedMessage(null);
                }}
                onDismiss={() => setShowUndoToast(false)}
            />
            <ScheduleModal
                isOpen={isScheduleModalOpen}
                onClose={() => setIsScheduleModalOpen(false)}
                onSchedule={handleScheduleMessage}
                isLoading={isScheduling}
            />
            {/* Call Modals */}
            <Suspense fallback={null}>
                <IncomingCallModal
                    visible={!!incomingCall}
                    callerName={incomingCall?.callerName || 'Unknown'}
                    callType={incomingCall?.callType || 'voice'}
                    onAccept={handleAcceptCall}
                    onReject={handleRejectCall}
                />
            </Suspense>

            {groupCallVisible && selectedRoomId && (
                <Suspense fallback={<LazyFallback />}>
                    <GroupCallScreen
                        roomId={selectedRoomId}
                        localStream={localStream}
                        callType={activeCallType}
                        onEndCall={handleEndGroupCall}
                    />
                </Suspense>
            )}

            {/* Space Settings Modal */}
            <Suspense fallback={null}>
                {currentRoom && currentRoom.room_type === 'group' && (
                    <SpaceSettingsModal
                        isOpen={isSpaceSettingsOpen}
                        onClose={() => setIsSpaceSettingsOpen(false)}
                        space={{
                            id: currentRoom.id,
                            name: currentRoom.name,
                            description: currentRoom.description,
                            tone: currentRoom.tone,
                        }}
                        currentUserId={currentUser?.id || 0}
                        onSpaceUpdated={(updatedSpace) => {
                            setRooms(prev => prev.map(r => r.id === updatedSpace.id ? { ...r, ...updatedSpace } : r));
                        }}
                        onSpaceLeft={() => {
                            setRooms(prev => prev.filter(r => r.id !== currentRoom.id));
                            setSelectedRoomId(null);
                        }}
                    />
                )}

                {/* Pinned Messages Drawer */}
                {currentRoom && (
                    <PinnedMessagesDrawer
                        isOpen={isPinnedDrawerOpen}
                        onClose={() => setIsPinnedDrawerOpen(false)}
                        roomId={currentRoom.id}
                        roomType={currentRoom.room_type}
                    />
                )}

                {/* Add to Constellation Menu */}
                <AddToConstellationMenu
                    isOpen={!!constellationTarget}
                    onClose={() => setConstellationTarget(null)}
                    messageId={constellationTarget?.messageId || ''}
                    roomId={constellationTarget?.roomId || 0}
                    position={constellationTarget?.position || { x: 0, y: 0 }}
                    onSuccess={() => success('Added to constellation')}
                />

                {/* Forward Modal */}
                <ForwardModal
                    isOpen={!!forwardingMessage}
                    onClose={() => setForwardingMessage(null)}
                    messagePreview={forwardingMessage?.content || ''}
                    rooms={rooms.map(r => ({ id: r.id, name: r.name, room_type: r.room_type }))}
                    onForward={async (roomIds) => {
                        if (!forwardingMessage) return;
                        // Forward to each selected room
                        for (const targetRoomId of roomIds) {
                            // For now, send to the current room - in a full implementation,
                            // we'd switch rooms or use a different socket emit
                            socketService.emit('message:send', {
                                roomId: targetRoomId,
                                content: `[Forwarded] ${forwardingMessage.content}`,
                                messageType: 'text',
                                metadata: { forwarded: true, originalMessageId: forwardingMessage.id }
                            });
                        }
                        success(`Forwarded to ${roomIds.length} chat${roomIds.length > 1 ? 's' : ''}`);
                        setForwardingMessage(null);
                    }}
                />
            </Suspense>
        </div>
    );
}

export default Home;
