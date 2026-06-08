/**
 * E2E Enhanced Message Hook
 * 
 * Provides E2E encryption for message sending and automatic decryption for incoming messages.
 */

import { useCallback, useMemo } from 'react';
import { e2eCryptoService } from '../crypto/E2ECryptoService';
import {
    prepareOutgoingMessage,
    processIncomingMessage,
    processIncomingMessages,
    getConversationE2EStatus,
    type PlaintextMessage,
    type IncomingMessage,
    type DecryptedMessage,
} from '../services/e2eMessageService';
import socketService from '../services/socket';

interface UseE2EMessagesOptions {
    roomId: number | null;
    roomType: 'direct' | 'group';
    peerUserId?: number; // For DM rooms
    onSendSuccess?: (message: any) => void;
    onSendError?: (error: Error, tempId: string) => void;
}

interface E2EMessageResult {
    sendMessage: (content: string, tempId: string) => Promise<void>;
    processMessage: (message: IncomingMessage) => Promise<DecryptedMessage>;
    processMessages: (messages: IncomingMessage[]) => Promise<DecryptedMessage[]>;
    isE2EEnabled: boolean;
    canUseE2E: boolean;
}

export function useE2EMessages({
    roomId,
    roomType,
    peerUserId,
    onSendSuccess,
    onSendError,
}: UseE2EMessagesOptions): E2EMessageResult {

    const isE2EEnabled = useMemo(() => e2eCryptoService.isEnabled(), []);
    const canUseE2E = useMemo(() => {
        // E2E only works for DM rooms currently (Phase 4 will add group support)
        return isE2EEnabled && roomType === 'direct' && !!peerUserId;
    }, [isE2EEnabled, roomType, peerUserId]);

    /**
     * Send a message with automatic E2E encryption if available
     */
    const sendMessage = useCallback(async (content: string, tempId: string) => {
        if (!roomId) {
            onSendError?.(new Error('No room selected'), tempId);
            return;
        }

        // For group rooms or non-E2E, send plaintext
        if (roomType === 'group' || !canUseE2E || !peerUserId) {
            socketService.sendMessage(roomId, content, tempId, (response) => {
                if (response.success) {
                    onSendSuccess?.(response.message);
                } else {
                    onSendError?.(new Error(response.error || 'Failed to send message'), tempId);
                }
            });
            return;
        }

        // Try E2E encryption for DM
        try {
            const message: PlaintextMessage = {
                roomId,
                content,
                messageType: 'text',
                tempId,
            };

            const { payload, isEncrypted } = await prepareOutgoingMessage(
                message,
                peerUserId,
                roomId
            );

            if (isEncrypted && 'e2e' in payload) {
                // Send encrypted message
                socketService.sendEncryptedMessage(
                    roomId,
                    payload.content,
                    tempId,
                    (response) => {
                        if (response.success) {
                            onSendSuccess?.(response.message);
                        } else {
                            onSendError?.(new Error(response.error || 'Failed to send message'), tempId);
                        }
                    },
                    payload.metadata
                );
            } else {
                // Fall back to plaintext
                socketService.sendMessage(roomId, content, tempId, (response) => {
                    if (response.success) {
                        onSendSuccess?.(response.message);
                    } else {
                        onSendError?.(new Error(response.error || 'Failed to send message'), tempId);
                    }
                });
            }
        } catch (error) {
            console.error('E2E encryption failed, falling back to plaintext:', error);
            // Fall back to plaintext on error
            socketService.sendMessage(roomId, content, tempId, (response) => {
                if (response.success) {
                    onSendSuccess?.(response.message);
                } else {
                    onSendError?.(new Error(response.error || 'Failed to send message'), tempId);
                }
            });
        }
    }, [roomId, roomType, canUseE2E, peerUserId, onSendSuccess, onSendError]);

    /**
     * Process a single incoming message (decrypt if needed)
     */
    const processMessage = useCallback(async (message: IncomingMessage): Promise<DecryptedMessage> => {
        return processIncomingMessage(message);
    }, []);

    /**
     * Process multiple incoming messages (batch decryption)
     */
    const processMessages = useCallback(async (messages: IncomingMessage[]): Promise<DecryptedMessage[]> => {
        return processIncomingMessages(messages);
    }, []);

    return {
        sendMessage,
        processMessage,
        processMessages,
        isE2EEnabled,
        canUseE2E,
    };
}

/**
 * Hook to check E2E status for a specific conversation
 */
export function useConversationE2EState(peerUserId: number | null) {
    const checkE2EStatus = useCallback(async () => {
        if (!peerUserId) {
            return {
                bothHaveE2E: false,
                selfHasE2E: false,
                peerHasE2E: false,
                safetyNumber: undefined,
            };
        }
        return getConversationE2EStatus(peerUserId);
    }, [peerUserId]);

    return { checkE2EStatus };
}

export default useE2EMessages;
