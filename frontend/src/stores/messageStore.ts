import { create } from 'zustand';
import axios from 'axios';

export interface Message {
    id: string;
    room_id: number;
    sender_id: number;
    content: string;
    message_type: string;
    created_at: Date;
    sender_username?: string;
    sender_avatar?: string;

    // Optimistic UI fields
    tempId?: string; // Temporary ID before server confirms
    status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    error?: string;
}

interface MessageState {
    messages: Record<number, Message[]>; // roomId -> messages
    hasMore: Record<number, boolean>; // roomId -> hasMore
    typingUsers: Record<number, Set<number>>; // roomId -> Set of userIds

    // Actions
    addOptimisticMessage: (message: Message) => void;
    confirmMessage: (tempId: string, serverMessage: Message) => void;
    markMessageFailed: (tempId: string, error: string) => void;
    addMessage: (roomId: number, message: Message) => void;
    updateMessageStatus: (messageId: string, status: string, userId: number) => void;
    loadMessages: (roomId: number, messages: Message[], append?: boolean) => void;
    setTyping: (roomId: number, userId: number, isTyping: boolean) => void;
    setHasMore: (roomId: number, hasMore: boolean) => void;
}

export const useMessageStore = create<MessageState>((set) => ({
    messages: {},
    hasMore: {},
    typingUsers: {},

    /**
     * Add optimistic message (shown immediately before server confirmation)
     */
    addOptimisticMessage: (message) => {
        set((state) => ({
            messages: {
                ...state.messages,
                [message.room_id]: [
                    message,
                    ...(state.messages[message.room_id] || []),
                ],
            },
        }));
    },

    /**
     * Confirm message from server (replace optimistic with real message)
     */
    confirmMessage: (tempId, serverMessage) => {
        set((state) => {
            const { messages } = state;
            const roomId = serverMessage.room_id;
            const roomMessages = messages[roomId] || [];

            const updatedMessages = roomMessages.map((msg) =>
                msg.tempId === tempId
                    ? { ...serverMessage, status: 'sent' as const }
                    : msg
            );

            return {
                messages: {
                    ...messages,
                    [roomId]: updatedMessages,
                },
            };
        });
    },

    /**
     * Mark optimistic message as failed
     */
    markMessageFailed: (tempId, error) => {
        set((state) => {
            const { messages } = state;
            const newMessages = { ...messages };

            // Find and update the failed message
            for (const roomId in newMessages) {
                newMessages[roomId] = newMessages[roomId].map((msg) =>
                    msg.tempId === tempId
                        ? { ...msg, status: 'failed' as const, error }
                        : msg
                );
            }

            return { messages: newMessages };
        });
    },

    /**
     * Add message from server (new message received)
     */
    addMessage: (roomId, message) => {
        set((state) => {
            const roomMessages = state.messages[roomId] || [];

            // Check if message already exists (avoid duplicates)
            const exists = roomMessages.some((m) => m.id === message.id);
            if (exists) return state;

            return {
                messages: {
                    ...state.messages,
                    [roomId]: [message, ...roomMessages],
                },
            };
        });
    },

    /**
     * Update message status (delivered/read receipts)
     */
    updateMessageStatus: (messageId, status, _userId) => {
        set((state) => {
            const { messages } = state;
            const newMessages = { ...messages };

            // Find and update the message
            for (const roomId in newMessages) {
                newMessages[roomId] = newMessages[roomId].map((msg) =>
                    msg.id === messageId
                        ? { ...msg, status: status as Message['status'] }
                        : msg
                );
            }

            return { messages: newMessages };
        });
    },

    /**
     * Load messages from API (for pagination)
     */
    loadMessages: (roomId, messages, append = false) => {
        set((state) => ({
            messages: {
                ...state.messages,
                [roomId]: append
                    ? [...(state.messages[roomId] || []), ...messages]
                    : messages,
            },
        }));
    },

    /**
     * Set typing indicator
     */
    setTyping: (roomId, userId, isTyping) => {
        set((state) => {
            const roomTypers = new Set(state.typingUsers[roomId] || []);

            if (isTyping) {
                roomTypers.add(userId);
            } else {
                roomTypers.delete(userId);
            }

            return {
                typingUsers: {
                    ...state.typingUsers,
                    [roomId]: roomTypers,
                },
            };
        });
    },

    /**
     * Set hasMore flag for pagination
     */
    setHasMore: (roomId, hasMore) => {
        set((state) => ({
            hasMore: {
                ...state.hasMore,
                [roomId]: hasMore,
            },
        }));
    },
}));

// API helper for loading message history with cursor pagination
export async function loadMessageHistory(
    roomId: number,
    cursor?: string,
    limit: number = 50
): Promise<{ messages: Message[]; nextCursor: string | null }> {
    try {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', cursor);
        params.append('limit', limit.toString());

        const response = await axios.get(
            `/api/messages/room/${roomId}?${params.toString()}`
        );

        return response.data;
    } catch (error) {
        console.error('Failed to load message history:', error);
        throw error;
    }
}
