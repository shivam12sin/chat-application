/**
 * Sender Keys Protocol Implementation
 * 
 * This implements the Signal Protocol's Sender Keys for efficient group messaging.
 * Sender Keys allows one encryption operation per message instead of N (one per recipient).
 * 
 * Reference: https://signal.org/docs/specifications/group-protocol/
 */

import {
    generateX25519KeyPair,
    exportPublicKey,
    exportPrivateKey,
    hmacSha256,
    aesGcmEncrypt,
    aesGcmDecrypt,
    toBase64,
    fromBase64,
    generateKeyId,
} from './utils';

// ============================================
// CONSTANTS
// ============================================

const MAX_RATCHET_STEPS = 2000;  // Maximum message keys per chain

// ============================================
// TYPES
// ============================================

/**
 * Sender Key state for a specific group/sender pair
 */
export interface SenderKeyState {
    // The sender's signing key pair (for authentication)
    signingKeyPair: {
        publicKey: Uint8Array;
        privateKey: Uint8Array;
    };
    // Current chain key (ratchets forward)
    chainKey: Uint8Array;
    // Message index in the current chain
    iteration: number;
    // Key ID for this sender key
    keyId: number;
}

/**
 * Sender Key distribution message (sent to new group members)
 */
export interface SenderKeyDistributionMessage {
    keyId: number;
    chainKey: string;         // Base64
    signingPublicKey: string; // Base64
    iteration: number;
}

/**
 * Sender Key record stored for receiving messages
 */
export interface SenderKeyRecord {
    chainKey: Uint8Array;
    signingPublicKey: Uint8Array;
    iteration: number;
    keyId: number;
    // Cache of derived message keys (for out-of-order messages)
    messageKeys: Map<number, Uint8Array>;
}

/**
 * Group-encrypted message
 */
export interface GroupEncryptedMessage {
    keyId: number;
    iteration: number;
    ciphertext: string;       // Base64
    signature: string;        // Base64 (HMAC signature)
}

// ============================================
// SENDER KEY STATE MANAGEMENT
// ============================================

/**
 * Generate a new Sender Key state for a group
 */
export async function generateSenderKeyState(): Promise<SenderKeyState> {
    // Generate signing key pair
    const keyPair = await generateX25519KeyPair();
    const publicKey = await exportPublicKey(keyPair.publicKey);
    const privateKey = await exportPrivateKey(keyPair.privateKey);
    
    // Generate random chain key
    const chainKey = crypto.getRandomValues(new Uint8Array(32));
    
    return {
        signingKeyPair: {
            publicKey,
            privateKey,
        },
        chainKey,
        iteration: 0,
        keyId: generateKeyId(),
    };
}

/**
 * Create a distribution message to send to group members
 */
export function createDistributionMessage(state: SenderKeyState): SenderKeyDistributionMessage {
    return {
        keyId: state.keyId,
        chainKey: toBase64(state.chainKey),
        signingPublicKey: toBase64(state.signingKeyPair.publicKey),
        iteration: state.iteration,
    };
}

/**
 * Parse a received distribution message
 */
export function parseDistributionMessage(message: SenderKeyDistributionMessage): SenderKeyRecord {
    return {
        chainKey: fromBase64(message.chainKey),
        signingPublicKey: fromBase64(message.signingPublicKey),
        iteration: message.iteration,
        keyId: message.keyId,
        messageKeys: new Map(),
    };
}

// ============================================
// KEY DERIVATION
// ============================================

/**
 * Derive message keys from chain key
 */
async function deriveMessageKey(chainKey: Uint8Array): Promise<{
    messageKey: Uint8Array;
    nextChainKey: Uint8Array;
}> {
    // Message key = HMAC-SHA256(chainKey, 0x01)
    const messageKey = await hmacSha256(chainKey, new Uint8Array([0x01]));
    
    // Next chain key = HMAC-SHA256(chainKey, 0x02)
    const nextChainKey = await hmacSha256(chainKey, new Uint8Array([0x02]));
    
    return { messageKey, nextChainKey };
}

/**
 * Advance chain to a specific iteration
 */
async function advanceChain(
    record: SenderKeyRecord,
    targetIteration: number
): Promise<Uint8Array> {
    // Check bounds
    if (targetIteration < record.iteration) {
        // Check message key cache
        const cached = record.messageKeys.get(targetIteration);
        if (cached) {
            record.messageKeys.delete(targetIteration);
            return cached;
        }
        throw new Error('Cannot decrypt message from the past without cached key');
    }
    
    if (targetIteration - record.iteration > MAX_RATCHET_STEPS) {
        throw new Error('Message too far in the future');
    }
    
    // Advance chain and cache intermediate keys
    let currentChainKey = record.chainKey;
    for (let i = record.iteration; i <= targetIteration; i++) {
        const { messageKey, nextChainKey } = await deriveMessageKey(currentChainKey);
        
        if (i === targetIteration) {
            // Update record
            record.chainKey = nextChainKey;
            record.iteration = i + 1;
            return messageKey;
        } else {
            // Cache for future out-of-order messages
            record.messageKeys.set(i, messageKey);
            currentChainKey = nextChainKey;
        }
    }
    
    throw new Error('Unexpected state in chain advancement');
}

// ============================================
// ENCRYPTION / DECRYPTION
// ============================================

/**
 * Encrypt a message using Sender Keys
 */
export async function senderKeyEncrypt(
    state: SenderKeyState,
    plaintext: Uint8Array
): Promise<GroupEncryptedMessage> {
    // Derive message key and advance chain
    const { messageKey, nextChainKey } = await deriveMessageKey(state.chainKey);
    
    // Encrypt message
    const { ciphertext, nonce } = await aesGcmEncrypt(plaintext, messageKey);
    
    // Combine nonce + ciphertext
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce, 0);
    combined.set(ciphertext, nonce.length);
    
    // Sign the ciphertext (using HMAC with signing key as we use X25519)
    const signature = await hmacSha256(state.signingKeyPair.privateKey, combined);
    
    // Update state
    const currentIteration = state.iteration;
    state.chainKey = nextChainKey;
    state.iteration++;
    
    return {
        keyId: state.keyId,
        iteration: currentIteration,
        ciphertext: toBase64(combined),
        signature: toBase64(signature),
    };
}

/**
 * Decrypt a message using Sender Keys
 */
export async function senderKeyDecrypt(
    record: SenderKeyRecord,
    message: GroupEncryptedMessage
): Promise<Uint8Array> {
    // Verify key ID matches
    if (message.keyId !== record.keyId) {
        throw new Error('Sender key ID mismatch');
    }
    
    // Decode ciphertext
    const combined = fromBase64(message.ciphertext);
    const signature = fromBase64(message.signature);
    
    // Verify signature
    const expectedSig = await hmacSha256(record.signingPublicKey, combined);
    let sigValid = true;
    if (signature.length !== expectedSig.length) {
        sigValid = false;
    } else {
        for (let i = 0; i < signature.length; i++) {
            if (signature[i] !== expectedSig[i]) sigValid = false;
        }
    }
    
    if (!sigValid) {
        throw new Error('Signature verification failed');
    }
    
    // Get message key (advances chain as needed)
    const messageKey = await advanceChain(record, message.iteration);
    
    // Extract nonce and ciphertext
    const nonce = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    // Decrypt
    return await aesGcmDecrypt(ciphertext, messageKey, nonce);
}

// ============================================
// SERIALIZATION
// ============================================

/**
 * Serialize sender key state for storage
 */
export function serializeSenderKeyState(state: SenderKeyState): string {
    return JSON.stringify({
        signingKeyPair: {
            publicKey: toBase64(state.signingKeyPair.publicKey),
            privateKey: toBase64(state.signingKeyPair.privateKey),
        },
        chainKey: toBase64(state.chainKey),
        iteration: state.iteration,
        keyId: state.keyId,
    });
}

/**
 * Deserialize sender key state from storage
 */
export function deserializeSenderKeyState(json: string): SenderKeyState {
    const data = JSON.parse(json);
    return {
        signingKeyPair: {
            publicKey: fromBase64(data.signingKeyPair.publicKey),
            privateKey: fromBase64(data.signingKeyPair.privateKey),
        },
        chainKey: fromBase64(data.chainKey),
        iteration: data.iteration,
        keyId: data.keyId,
    };
}

/**
 * Serialize sender key record for storage
 */
export function serializeSenderKeyRecord(record: SenderKeyRecord): string {
    const messageKeysObj: Record<string, string> = {};
    record.messageKeys.forEach((value, key) => {
        messageKeysObj[key.toString()] = toBase64(value);
    });
    
    return JSON.stringify({
        chainKey: toBase64(record.chainKey),
        signingPublicKey: toBase64(record.signingPublicKey),
        iteration: record.iteration,
        keyId: record.keyId,
        messageKeys: messageKeysObj,
    });
}

/**
 * Deserialize sender key record from storage
 */
export function deserializeSenderKeyRecord(json: string): SenderKeyRecord {
    const data = JSON.parse(json);
    
    const messageKeys = new Map<number, Uint8Array>();
    if (data.messageKeys) {
        Object.entries(data.messageKeys).forEach(([key, value]) => {
            messageKeys.set(parseInt(key, 10), fromBase64(value as string));
        });
    }
    
    return {
        chainKey: fromBase64(data.chainKey),
        signingPublicKey: fromBase64(data.signingPublicKey),
        iteration: data.iteration,
        keyId: data.keyId,
        messageKeys,
    };
}
