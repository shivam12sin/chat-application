/**
 * E2E Message Service
 * 
 * Integrates E2E encryption with the message flow.
 * This service handles encrypting outgoing messages and decrypting incoming messages.
 */

import { e2eCryptoService, type EncryptedPayload } from '../crypto/E2ECryptoService';
import { groupE2EService, type GroupEncryptedPayload } from '../crypto/GroupE2EService';

// ============================================
// TYPES
// ============================================

export interface PlaintextMessage {
    roomId: number;
    content: string;
    messageType?: 'text' | 'image' | 'file';
    metadata?: Record<string, any>;
    tempId?: string;
}

export interface EncryptedMessagePayload {
    roomId: number;
    content: string;  // JSON stringified EncryptedPayload
    messageType: 'encrypted';
    metadata?: Record<string, any>;
    tempId?: string;
    e2e: true;  // Flag to indicate E2E encrypted content
}

export interface IncomingMessage {
    id: string;
    room_id: number;
    sender_id: number;
    content: string;
    message_type: string;
    created_at: string;
    sender_username?: string;
    sender_avatar?: string;
    e2e?: boolean;  // Flag indicating E2E encrypted
}

export interface DecryptedMessage extends Omit<IncomingMessage, 'content'> {
    content: string;
    e2eDecrypted?: boolean;
    decryptionError?: string;
}

export interface E2EMessageStatus {
    isEncrypted: boolean;
    peerHasE2E: boolean;
    decryptedSuccessfully?: boolean;
    error?: string;
}

// ============================================
// ENCRYPTION FOR OUTGOING MESSAGES
// ============================================

/**
 * Prepare a message for sending with E2E encryption
 * If the recipient has E2E enabled, the message will be encrypted.
 * Otherwise, it falls back to plaintext.
 */
export async function prepareOutgoingMessage(
    message: PlaintextMessage,
    recipientUserId: number,
    roomId: number
): Promise<{
    payload: PlaintextMessage | EncryptedMessagePayload;
    isEncrypted: boolean;
}> {
    // Check if E2E is enabled for this user
    if (!e2eCryptoService.isEnabled()) {
        return { payload: message, isEncrypted: false };
    }

    // Check if recipient has E2E enabled
    const recipientHasE2E = await e2eCryptoService.isUserE2EEnabled(recipientUserId);
    if (!recipientHasE2E) {
        console.log(`Recipient ${recipientUserId} does not have E2E enabled, sending plaintext`);
        return { payload: message, isEncrypted: false };
    }

    try {
        // Encrypt the message
        const encrypted = await e2eCryptoService.encryptMessage(
            recipientUserId,
            message.content,
            roomId
        );

        // Create encrypted payload
        const encryptedPayload: EncryptedMessagePayload = {
            roomId: message.roomId,
            content: JSON.stringify(encrypted),
            messageType: 'encrypted',
            metadata: {
                ...message.metadata,
                originalType: message.messageType || 'text',
            },
            tempId: message.tempId,
            e2e: true,
        };

        console.log('Message encrypted successfully for user', recipientUserId);
        return { payload: encryptedPayload, isEncrypted: true };
    } catch (error) {
        console.error('Failed to encrypt message:', error);
        // Fall back to plaintext on encryption failure
        return { payload: message, isEncrypted: false };
    }
}

/**
 * Prepare a message for a group/space with E2E encryption
 * Uses Sender Keys protocol for efficient group encryption
 */
export async function prepareGroupMessage(
    message: PlaintextMessage,
    memberUserIds: number[],
    roomId: number
): Promise<{
    payload: PlaintextMessage | EncryptedMessagePayload;
    isEncrypted: boolean;
    senderKeyDistribution?: string;  // For new members who need the sender key
}> {
    // Check if E2E is enabled for this user
    if (!e2eCryptoService.isEnabled()) {
        return { payload: message, isEncrypted: false };
    }

    // Check if the room has E2E initialized
    const roomState = groupE2EService.getRoomState(roomId.toString());
    
    // If room isn't initialized, try to initialize it
    if (!roomState) {
        try {
            await groupE2EService.initializeForRoom(roomId.toString(), memberUserIds);
            console.log(`Initialized E2E for room ${roomId}`);
        } catch (error) {
            console.error('Failed to initialize group E2E:', error);
            return { payload: message, isEncrypted: false };
        }
    }

    try {
        // Encrypt the message using Sender Keys
        const encrypted = await groupE2EService.encryptForGroup(
            roomId.toString(),
            message.content
        );

        // Create encrypted payload
        const encryptedPayload: EncryptedMessagePayload = {
            roomId: message.roomId,
            content: JSON.stringify(encrypted),
            messageType: 'encrypted',
            metadata: {
                ...message.metadata,
                originalType: message.messageType || 'text',
                isGroupE2E: true,
            },
            tempId: message.tempId,
            e2e: true,
        };

        console.log('Group message encrypted successfully for room', roomId);
        return { payload: encryptedPayload, isEncrypted: true };
    } catch (error) {
        console.error('Failed to encrypt group message:', error);
        // Fall back to plaintext on encryption failure
        return { payload: message, isEncrypted: false };
    }
}

// ============================================
// DECRYPTION FOR INCOMING MESSAGES
// ============================================

/**
 * Process an incoming message, decrypting if necessary
 */
export async function processIncomingMessage(
    message: IncomingMessage
): Promise<DecryptedMessage> {
    // Check if this is an encrypted message
    if (!message.e2e || message.message_type !== 'encrypted') {
        return {
            ...message,
            e2eDecrypted: false,
        };
    }

    // Check if E2E is enabled for this user
    if (!e2eCryptoService.isEnabled()) {
        return {
            ...message,
            content: '[E2E encrypted message - enable encryption to view]',
            e2eDecrypted: false,
            decryptionError: 'E2E not enabled',
        };
    }

    try {
        // Parse the encrypted payload
        const encrypted = JSON.parse(message.content);
        
        // Check if this is a group E2E message (Sender Keys)
        if (encrypted.isGroupE2E || encrypted.senderKeyId !== undefined) {
            // Decrypt using Sender Keys (group message)
            const decrypted = await groupE2EService.decryptFromGroup(
                message.room_id.toString(),
                message.sender_id,
                encrypted as GroupEncryptedPayload
            );

            return {
                ...message,
                content: decrypted,
                message_type: 'text',
                e2eDecrypted: true,
            };
        } else {
            // Decrypt using Double Ratchet (DM)
            const decrypted = await e2eCryptoService.decryptMessage(
                message.sender_id,
                encrypted as EncryptedPayload,
                message.room_id
            );

            return {
                ...message,
                content: decrypted,
                message_type: 'text',
                e2eDecrypted: true,
            };
        }
    } catch (error) {
        console.error('Failed to decrypt message:', error);
        return {
            ...message,
            content: '[Failed to decrypt message]',
            e2eDecrypted: false,
            decryptionError: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Process multiple incoming messages (batch decryption)
 */
export async function processIncomingMessages(
    messages: IncomingMessage[]
): Promise<DecryptedMessage[]> {
    return Promise.all(messages.map(processIncomingMessage));
}

// ============================================
// UTILITIES
// ============================================

/**
 * Check if a message is encrypted
 */
export function isEncryptedMessage(message: IncomingMessage): boolean {
    return message.e2e === true && message.message_type === 'encrypted';
}

/**
 * Get E2E status for a conversation
 */
export async function getConversationE2EStatus(
    peerUserId: number
): Promise<{
    bothHaveE2E: boolean;
    selfHasE2E: boolean;
    peerHasE2E: boolean;
    safetyNumber?: string;
}> {
    const selfHasE2E = e2eCryptoService.isEnabled();
    const peerHasE2E = selfHasE2E ? await e2eCryptoService.isUserE2EEnabled(peerUserId) : false;
    const bothHaveE2E = selfHasE2E && peerHasE2E;

    let safetyNumber: string | undefined;
    if (bothHaveE2E) {
        try {
            safetyNumber = await e2eCryptoService.getSafetyNumber(peerUserId);
        } catch (error) {
            console.error('Failed to get safety number:', error);
        }
    }

    return {
        bothHaveE2E,
        selfHasE2E,
        peerHasE2E,
        safetyNumber,
    };
}

/**
 * Get verification info for displaying in UI
 */
export async function getVerificationInfo(peerUserId: number): Promise<{
    ownFingerprint: string | null;
    peerFingerprint: string | null;
    safetyNumber: string | null;
}> {
    if (!e2eCryptoService.isEnabled()) {
        return {
            ownFingerprint: null,
            peerFingerprint: null,
            safetyNumber: null,
        };
    }

    const ownFingerprint = await e2eCryptoService.getOwnFingerprint();
    
    let peerFingerprint: string | null = null;
    let safetyNumber: string | null = null;
    
    try {
        safetyNumber = await e2eCryptoService.getSafetyNumber(peerUserId);
    } catch {
        // Peer might not have E2E enabled
    }

    return {
        ownFingerprint,
        peerFingerprint,
        safetyNumber,
    };
}

// ============================================
// GROUP E2E UTILITIES
// ============================================

/**
 * Initialize E2E for a group room
 */
export async function initializeGroupE2E(
    roomId: number,
    memberUserIds: number[]
): Promise<boolean> {
    if (!e2eCryptoService.isEnabled()) {
        return false;
    }

    try {
        await groupE2EService.initializeForRoom(roomId.toString(), memberUserIds);
        return true;
    } catch (error) {
        console.error('Failed to initialize group E2E:', error);
        return false;
    }
}

/**
 * Handle a new member joining a group
 */
export async function handleGroupMemberJoined(
    roomId: number,
    newMemberUserId: number
): Promise<void> {
    if (!e2eCryptoService.isEnabled()) {
        return;
    }

    try {
        await groupE2EService.handleMemberJoined(roomId.toString(), newMemberUserId);
    } catch (error) {
        console.error('Failed to handle member joined:', error);
    }
}

/**
 * Handle a member leaving a group
 */
export async function handleGroupMemberLeft(
    roomId: number,
    leftMemberUserId: number
): Promise<void> {
    if (!e2eCryptoService.isEnabled()) {
        return;
    }

    try {
        await groupE2EService.handleMemberLeft(roomId.toString(), leftMemberUserId);
    } catch (error) {
        console.error('Failed to handle member left:', error);
    }
}

/**
 * Get group E2E status
 */
export function getGroupE2EStatus(roomId: number): {
    isInitialized: boolean;
    memberCount: number;
    hasSenderKey: boolean;
} {
    const roomState = groupE2EService.getRoomState(roomId.toString());
    
    if (!roomState) {
        return {
            isInitialized: false,
            memberCount: 0,
            hasSenderKey: false,
        };
    }

    return {
        isInitialized: roomState.isInitialized,
        memberCount: roomState.members.length,
        hasSenderKey: roomState.ownSenderKeyId !== undefined,
    };
}

/**
 * Process a sender key distribution message
 */
export async function processSenderKeyDistribution(
    roomId: number,
    senderUserId: number,
    distribution: string
): Promise<void> {
    if (!e2eCryptoService.isEnabled()) {
        return;
    }

    try {
        await groupE2EService.processSenderKeyDistribution(
            roomId.toString(),
            senderUserId,
            distribution
        );
    } catch (error) {
        console.error('Failed to process sender key distribution:', error);
    }
}
