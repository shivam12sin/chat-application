/**
 * Double Ratchet Algorithm Implementation
 * 
 * This implements the Signal Protocol's Double Ratchet for forward secrecy
 * and break-in recovery in ongoing message encryption.
 * 
 * Reference: https://signal.org/docs/specifications/doubleratchet/
 */

import {
    generateX25519KeyPair,
    exportPublicKey,
    exportPrivateKey,
    importX25519PublicKey,
    importX25519PrivateKey,
    x25519,
    hkdf,
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

const MAX_SKIP = 1000;  // Maximum message keys to skip
const INFO_RATCHET = new TextEncoder().encode('DoubleRatchet');
const INFO_MESSAGE_KEYS = new TextEncoder().encode('MessageKeys');

// ============================================
// TYPES
// ============================================

/**
 * Ratchet key pair (changes with each DH ratchet step)
 */
export interface RatchetKeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}

/**
 * Message keys derived from the chain key
 */
export interface MessageKeys {
    encryptionKey: Uint8Array;  // 32 bytes
    macKey: Uint8Array;         // 32 bytes  
    iv: Uint8Array;             // 16 bytes
}

/**
 * Skipped message key entry
 */
interface SkippedMessageKey {
    dhPublicKey: string;  // base64
    messageIndex: number;
    messageKey: Uint8Array;
    timestamp: number;
}

/**
 * Double Ratchet session state
 */
export interface SessionState {
    // DH Ratchet state
    dhSendingKeyPair: RatchetKeyPair | null;
    dhReceivingKey: Uint8Array | null;
    
    // Root key (evolves with each DH ratchet)
    rootKey: Uint8Array;
    
    // Chain keys
    sendingChainKey: Uint8Array | null;
    receivingChainKey: Uint8Array | null;
    
    // Message indices
    sendingMessageIndex: number;
    receivingMessageIndex: number;
    previousSendingChainLength: number;
    
    // Skipped message keys (for out-of-order messages)
    skippedMessageKeys: SkippedMessageKey[];
    
    // Metadata
    remoteIdentityKey: Uint8Array;
    localIdentityPublicKey: Uint8Array;
    sessionId: string;
    createdAt: number;
    lastMessageAt: number;
}

/**
 * Encrypted message with ratchet header
 */
export interface EncryptedMessage {
    header: MessageHeader;
    ciphertext: Uint8Array;
    nonce: Uint8Array;
}

/**
 * Message header (sent in clear alongside ciphertext)
 */
export interface MessageHeader {
    dhPublicKey: Uint8Array;    // Current ratchet public key
    previousChainLength: number; // N in previous sending chain
    messageIndex: number;        // N in current sending chain
}

// ============================================
// SESSION INITIALIZATION
// ============================================

/**
 * Initialize session as the initiator (who sends first message)
 * Called after X3DH key agreement
 */
export async function initializeSessionAsInitiator(
    sharedSecret: Uint8Array,
    remoteIdentityKey: Uint8Array,
    localIdentityPublicKey: Uint8Array,
    remoteSignedPreKey: Uint8Array
): Promise<SessionState> {
    // Generate our first ratchet key pair
    const dhKeyPair = await generateX25519KeyPair();
    const dhSendingKeyPair: RatchetKeyPair = {
        publicKey: await exportPublicKey(dhKeyPair.publicKey),
        privateKey: await exportPrivateKey(dhKeyPair.privateKey),
    };

    // Perform initial DH ratchet
    const remoteKey = await importX25519PublicKey(remoteSignedPreKey);
    const dhOutput = await x25519(dhKeyPair.privateKey, remoteKey);

    // Derive root key and sending chain key
    const [rootKey, sendingChainKey] = await kdfRootKey(sharedSecret, dhOutput);

    return {
        dhSendingKeyPair,
        dhReceivingKey: remoteSignedPreKey,
        rootKey,
        sendingChainKey,
        receivingChainKey: null,
        sendingMessageIndex: 0,
        receivingMessageIndex: 0,
        previousSendingChainLength: 0,
        skippedMessageKeys: [],
        remoteIdentityKey,
        localIdentityPublicKey,
        sessionId: `session_${generateKeyId()}`,
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
    };
}

/**
 * Initialize session as the responder (who receives first message)
 * Called after X3DH key agreement
 */
export async function initializeSessionAsResponder(
    sharedSecret: Uint8Array,
    remoteIdentityKey: Uint8Array,
    localIdentityPublicKey: Uint8Array,
    localSignedPreKey: RatchetKeyPair
): Promise<SessionState> {
    return {
        dhSendingKeyPair: localSignedPreKey,
        dhReceivingKey: null,
        rootKey: sharedSecret,
        sendingChainKey: null,
        receivingChainKey: null,
        sendingMessageIndex: 0,
        receivingMessageIndex: 0,
        previousSendingChainLength: 0,
        skippedMessageKeys: [],
        remoteIdentityKey,
        localIdentityPublicKey,
        sessionId: `session_${generateKeyId()}`,
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
    };
}

// ============================================
// KEY DERIVATION FUNCTIONS
// ============================================

/**
 * KDF for root key chain
 * Returns [new_root_key, chain_key]
 */
async function kdfRootKey(
    rootKey: Uint8Array,
    dhOutput: Uint8Array
): Promise<[Uint8Array, Uint8Array]> {
    const derived = await hkdf(
        dhOutput,
        rootKey,
        INFO_RATCHET,
        64
    );
    return [derived.slice(0, 32), derived.slice(32, 64)];
}

/**
 * KDF for chain key (symmetric ratchet)
 * Returns [new_chain_key, message_key]
 */
async function kdfChainKey(chainKey: Uint8Array): Promise<[Uint8Array, Uint8Array]> {
    // Chain key constant: 0x01
    const chainKeyInput = new Uint8Array([0x01]);
    const newChainKey = await hmacSha256(chainKey, chainKeyInput);
    
    // Message key constant: 0x02
    const messageKeyInput = new Uint8Array([0x02]);
    const messageKey = await hmacSha256(chainKey, messageKeyInput);
    
    return [newChainKey, messageKey];
}

/**
 * Derive encryption keys from message key
 */
async function deriveMessageKeys(messageKey: Uint8Array): Promise<MessageKeys> {
    const derived = await hkdf(
        messageKey,
        new Uint8Array(32), // Zero salt
        INFO_MESSAGE_KEYS,
        80 // 32 + 32 + 16
    );
    
    return {
        encryptionKey: derived.slice(0, 32),
        macKey: derived.slice(32, 64),
        iv: derived.slice(64, 80),
    };
}

// ============================================
// DH RATCHET
// ============================================

/**
 * Perform DH ratchet step when receiving a new DH public key
 */
async function dhRatchet(
    state: SessionState,
    headerDhKey: Uint8Array
): Promise<void> {
    // Save previous sending chain length
    state.previousSendingChainLength = state.sendingMessageIndex;
    state.sendingMessageIndex = 0;
    state.receivingMessageIndex = 0;

    // Update receiving DH key
    state.dhReceivingKey = headerDhKey;

    // Derive new receiving chain key
    if (state.dhSendingKeyPair) {
        const dhPrivate = await importX25519PrivateKey(state.dhSendingKeyPair.privateKey);
        const dhPublic = await importX25519PublicKey(headerDhKey);
        const dhOutput = await x25519(dhPrivate, dhPublic);
        const [newRootKey, receivingChainKey] = await kdfRootKey(state.rootKey, dhOutput);
        state.rootKey = newRootKey;
        state.receivingChainKey = receivingChainKey;
    }

    // Generate new sending key pair
    const newKeyPair = await generateX25519KeyPair();
    state.dhSendingKeyPair = {
        publicKey: await exportPublicKey(newKeyPair.publicKey),
        privateKey: await exportPrivateKey(newKeyPair.privateKey),
    };

    // Derive new sending chain key
    const dhPublic = await importX25519PublicKey(headerDhKey);
    const dhOutput = await x25519(newKeyPair.privateKey, dhPublic);
    const [newRootKey, sendingChainKey] = await kdfRootKey(state.rootKey, dhOutput);
    state.rootKey = newRootKey;
    state.sendingChainKey = sendingChainKey;
}

// ============================================
// ENCRYPTION
// ============================================

/**
 * Encrypt a message
 */
export async function encrypt(
    state: SessionState,
    plaintext: Uint8Array
): Promise<EncryptedMessage> {
    // Ensure we have a sending chain
    if (!state.sendingChainKey || !state.dhSendingKeyPair) {
        throw new Error('Session not initialized for sending');
    }

    // Derive message key and advance chain
    const [newChainKey, messageKey] = await kdfChainKey(state.sendingChainKey);
    state.sendingChainKey = newChainKey;

    // Derive encryption keys
    const keys = await deriveMessageKeys(messageKey);

    // Create header
    const header: MessageHeader = {
        dhPublicKey: state.dhSendingKeyPair.publicKey,
        previousChainLength: state.previousSendingChainLength,
        messageIndex: state.sendingMessageIndex,
    };

    // Increment message index
    state.sendingMessageIndex++;
    state.lastMessageAt = Date.now();

    // Encrypt with associated data (header)
    const headerBytes = serializeHeader(header);
    const { ciphertext, nonce } = await aesGcmEncrypt(plaintext, keys.encryptionKey, headerBytes);

    return { header, ciphertext, nonce };
}

/**
 * Decrypt a message
 */
export async function decrypt(
    state: SessionState,
    message: EncryptedMessage
): Promise<Uint8Array> {
    // Try skipped message keys first
    const plaintext = await tryDecryptWithSkippedKeys(state, message);
    if (plaintext) {
        return plaintext;
    }

    // Check if we need to perform DH ratchet
    const headerDhKeyBase64 = toBase64(message.header.dhPublicKey);
    const currentDhKeyBase64 = state.dhReceivingKey ? toBase64(state.dhReceivingKey) : null;

    if (headerDhKeyBase64 !== currentDhKeyBase64) {
        // Skip any remaining messages in the current receiving chain
        if (state.receivingChainKey) {
            await skipMessageKeys(state, message.header.previousChainLength);
        }

        // Perform DH ratchet
        await dhRatchet(state, message.header.dhPublicKey);
    }

    // Skip to the correct message index
    await skipMessageKeys(state, message.header.messageIndex);

    // Derive message key
    if (!state.receivingChainKey) {
        throw new Error('No receiving chain key');
    }

    const [newChainKey, messageKey] = await kdfChainKey(state.receivingChainKey);
    state.receivingChainKey = newChainKey;
    state.receivingMessageIndex++;
    state.lastMessageAt = Date.now();

    // Derive decryption keys
    const keys = await deriveMessageKeys(messageKey);

    // Decrypt
    const headerBytes = serializeHeader(message.header);
    return await aesGcmDecrypt(message.ciphertext, keys.encryptionKey, message.nonce, headerBytes);
}

// ============================================
// SKIPPED MESSAGE KEYS
// ============================================

/**
 * Skip message keys and store them for later
 */
async function skipMessageKeys(state: SessionState, until: number): Promise<void> {
    if (!state.receivingChainKey) return;

    if (state.receivingMessageIndex + MAX_SKIP < until) {
        throw new Error('Too many skipped messages');
    }

    const dhKeyBase64 = state.dhReceivingKey ? toBase64(state.dhReceivingKey) : '';

    while (state.receivingMessageIndex < until) {
        const [newChainKey, messageKey] = await kdfChainKey(state.receivingChainKey);
        state.receivingChainKey = newChainKey;

        state.skippedMessageKeys.push({
            dhPublicKey: dhKeyBase64,
            messageIndex: state.receivingMessageIndex,
            messageKey: messageKey,
            timestamp: Date.now(),
        });

        state.receivingMessageIndex++;
    }

    // Limit stored skipped keys
    while (state.skippedMessageKeys.length > MAX_SKIP) {
        state.skippedMessageKeys.shift();
    }
}

/**
 * Try to decrypt with a skipped message key
 */
async function tryDecryptWithSkippedKeys(
    state: SessionState,
    message: EncryptedMessage
): Promise<Uint8Array | null> {
    const dhKeyBase64 = toBase64(message.header.dhPublicKey);

    const index = state.skippedMessageKeys.findIndex(
        sk => sk.dhPublicKey === dhKeyBase64 && sk.messageIndex === message.header.messageIndex
    );

    if (index === -1) return null;

    const skipped = state.skippedMessageKeys[index];
    state.skippedMessageKeys.splice(index, 1);

    const keys = await deriveMessageKeys(skipped.messageKey);
    const headerBytes = serializeHeader(message.header);

    try {
        return await aesGcmDecrypt(message.ciphertext, keys.encryptionKey, message.nonce, headerBytes);
    } catch {
        return null;
    }
}

// ============================================
// SERIALIZATION
// ============================================

/**
 * Serialize message header
 */
export function serializeHeader(header: MessageHeader): Uint8Array {
    // Format: [dhPublicKey(32) | previousChainLength(4) | messageIndex(4)]
    const buffer = new Uint8Array(40);
    buffer.set(header.dhPublicKey, 0);
    
    const view = new DataView(buffer.buffer);
    view.setUint32(32, header.previousChainLength, false);
    view.setUint32(36, header.messageIndex, false);
    
    return buffer;
}

/**
 * Deserialize message header
 */
export function deserializeHeader(data: Uint8Array): MessageHeader {
    if (data.length < 40) {
        throw new Error('Invalid header length');
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    return {
        dhPublicKey: data.slice(0, 32),
        previousChainLength: view.getUint32(32, false),
        messageIndex: view.getUint32(36, false),
    };
}

/**
 * Serialize encrypted message for transmission
 */
export function serializeEncryptedMessage(message: EncryptedMessage): Uint8Array {
    const header = serializeHeader(message.header);
    // Format: [header(40) | nonce(12) | ciphertext_length(4) | ciphertext]
    const buffer = new Uint8Array(40 + 12 + 4 + message.ciphertext.length);
    
    buffer.set(header, 0);
    buffer.set(message.nonce, 40);
    
    const view = new DataView(buffer.buffer);
    view.setUint32(52, message.ciphertext.length, false);
    
    buffer.set(message.ciphertext, 56);
    
    return buffer;
}

/**
 * Deserialize encrypted message from received data
 */
export function deserializeEncryptedMessage(data: Uint8Array): EncryptedMessage {
    if (data.length < 56) {
        throw new Error('Invalid message length');
    }

    const header = deserializeHeader(data.slice(0, 40));
    const nonce = data.slice(40, 52);
    
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const ciphertextLength = view.getUint32(52, false);
    
    if (data.length < 56 + ciphertextLength) {
        throw new Error('Message truncated');
    }
    
    const ciphertext = data.slice(56, 56 + ciphertextLength);

    return { header, ciphertext, nonce };
}

// ============================================
// SESSION STATE SERIALIZATION
// ============================================

/**
 * Serialize session state for storage
 * Note: This should be encrypted before storing!
 */
export function serializeSessionState(state: SessionState): string {
    return JSON.stringify({
        dhSendingKeyPair: state.dhSendingKeyPair ? {
            publicKey: toBase64(state.dhSendingKeyPair.publicKey),
            privateKey: toBase64(state.dhSendingKeyPair.privateKey),
        } : null,
        dhReceivingKey: state.dhReceivingKey ? toBase64(state.dhReceivingKey) : null,
        rootKey: toBase64(state.rootKey),
        sendingChainKey: state.sendingChainKey ? toBase64(state.sendingChainKey) : null,
        receivingChainKey: state.receivingChainKey ? toBase64(state.receivingChainKey) : null,
        sendingMessageIndex: state.sendingMessageIndex,
        receivingMessageIndex: state.receivingMessageIndex,
        previousSendingChainLength: state.previousSendingChainLength,
        skippedMessageKeys: state.skippedMessageKeys.map(sk => ({
            ...sk,
            messageKey: toBase64(sk.messageKey),
        })),
        remoteIdentityKey: toBase64(state.remoteIdentityKey),
        localIdentityPublicKey: toBase64(state.localIdentityPublicKey),
        sessionId: state.sessionId,
        createdAt: state.createdAt,
        lastMessageAt: state.lastMessageAt,
    });
}

/**
 * Deserialize session state from storage
 */
export function deserializeSessionState(json: string): SessionState {
    const data = JSON.parse(json);
    return {
        dhSendingKeyPair: data.dhSendingKeyPair ? {
            publicKey: fromBase64(data.dhSendingKeyPair.publicKey),
            privateKey: fromBase64(data.dhSendingKeyPair.privateKey),
        } : null,
        dhReceivingKey: data.dhReceivingKey ? fromBase64(data.dhReceivingKey) : null,
        rootKey: fromBase64(data.rootKey),
        sendingChainKey: data.sendingChainKey ? fromBase64(data.sendingChainKey) : null,
        receivingChainKey: data.receivingChainKey ? fromBase64(data.receivingChainKey) : null,
        sendingMessageIndex: data.sendingMessageIndex,
        receivingMessageIndex: data.receivingMessageIndex,
        previousSendingChainLength: data.previousSendingChainLength,
        skippedMessageKeys: data.skippedMessageKeys.map((sk: any) => ({
            ...sk,
            messageKey: fromBase64(sk.messageKey),
        })),
        remoteIdentityKey: fromBase64(data.remoteIdentityKey),
        localIdentityPublicKey: fromBase64(data.localIdentityPublicKey),
        sessionId: data.sessionId,
        createdAt: data.createdAt,
        lastMessageAt: data.lastMessageAt,
    };
}
