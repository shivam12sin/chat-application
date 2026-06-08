/**
 * E2E Encryption Module
 * 
 * Implements the Signal Protocol for end-to-end encrypted messaging.
 * 
 * Architecture:
 * - utils.ts: Low-level cryptographic primitives (ECDH, HKDF, AES-GCM, signing)
 * - x3dh.ts: Extended Triple Diffie-Hellman key agreement protocol
 * - doubleRatchet.ts: Double Ratchet algorithm for forward-secret messaging
 * - senderKeys.ts: Sender Keys protocol for efficient group encryption
 * - keyStore.ts: Secure IndexedDB storage for cryptographic material
 * - E2ECryptoService.ts: High-level API for DM encryption
 * - GroupE2EService.ts: High-level API for group encryption
 * 
 * Usage:
 * ```typescript
 * import { e2eCryptoService, groupE2EService } from './crypto';
 * 
 * // Initialize on app start
 * await e2eCryptoService.initialize({
 *   apiUrl: 'http://localhost:3001/api',
 *   token: 'your-jwt-token',
 *   userId: 123,
 * });
 * 
 * // Enable E2E for first time
 * await e2eCryptoService.enableE2E();
 * 
 * // Encrypt a DM message
 * const encrypted = await e2eCryptoService.encryptMessage(456, 'Hello!');
 * 
 * // Decrypt a DM message
 * const plaintext = await e2eCryptoService.decryptMessage(456, encryptedPayload);
 * 
 * // Get safety number for verification
 * const safetyNumber = await e2eCryptoService.getSafetyNumber(456);
 * 
 * // Initialize group E2E for a room
 * await groupE2EService.initializeForRoom('room-123', [userId1, userId2]);
 * 
 * // Encrypt a group message
 * const groupEncrypted = await groupE2EService.encryptForGroup('room-123', 'Hello group!');
 * 
 * // Decrypt a group message
 * const groupPlaintext = await groupE2EService.decryptFromGroup('room-123', senderId, encryptedPayload);
 * ```
 */

// Main service
export { 
    e2eCryptoService, 
    default as E2ECryptoService,
    type E2EConfig,
    type EncryptedPayload,
    type E2EStatus,
} from './E2ECryptoService';

// Group E2E Service
export {
    groupE2EService,
    default as GroupE2EService,
    type GroupE2EConfig,
    type GroupEncryptedPayload,
    type GroupMember,
    type RoomE2EState,
} from './GroupE2EService';

// Multi-Device Service
export {
    multiDeviceService,
    default as MultiDeviceService,
    type DeviceInfo,
    type DeviceLinkRequest,
    type DeviceKeyBundle,
    type DeviceRegistrationData,
    type KeyBackup,
    type MultiDeviceConfig,
} from './MultiDeviceService';

// Sender Keys Protocol (Group Encryption)
export {
    generateSenderKeyState,
    createDistributionMessage,
    parseDistributionMessage,
    senderKeyEncrypt,
    senderKeyDecrypt,
    serializeSenderKeyState,
    deserializeSenderKeyState,
    serializeSenderKeyRecord,
    deserializeSenderKeyRecord,
    type SenderKeyState,
    type SenderKeyDistributionMessage,
    type SenderKeyRecord,
    type GroupEncryptedMessage,
} from './senderKeys';

// X3DH Key Agreement
export {
    generateIdentityKeyPair,
    generateSignedPreKey,
    generateOneTimePreKeys,
    createPublicKeyBundle,
    parseReceivedKeyBundle,
    x3dhInitiate,
    x3dhRespond,
    createX3DHHeader,
    serializeX3DHHeader,
    deserializeX3DHHeader,
    generateFullKeyBundle,
    type IdentityKeyPair,
    type SignedPreKey,
    type OneTimePreKey,
    type PublicKeyBundle,
    type ReceivedKeyBundle,
    type X3DHResult,
    type X3DHHeader,
} from './x3dh';

// Double Ratchet
export {
    initializeSessionAsInitiator,
    initializeSessionAsResponder,
    encrypt,
    decrypt,
    serializeHeader,
    deserializeHeader,
    serializeEncryptedMessage,
    deserializeEncryptedMessage,
    serializeSessionState,
    deserializeSessionState,
    type RatchetKeyPair,
    type MessageKeys,
    type SessionState,
    type EncryptedMessage,
    type MessageHeader,
} from './doubleRatchet';

// Key Storage
export {
    storeIdentityKeyPair,
    getIdentityKeyPair,
    hasIdentityKey,
    storeSignedPreKey,
    getSignedPreKey,
    getCurrentSignedPreKey,
    storeOneTimePreKeys,
    getOneTimePreKey,
    markOneTimePreKeyUsed,
    countUnusedOneTimePreKeys,
    getHighestPreKeyId,
    storeSession,
    getSession,
    deleteSession,
    getAllSessions,
    storeMetadata,
    getMetadata,
    clearAllData,
    closeDatabase,
    exportAllData,
} from './keyStore';

// Utilities
export {
    generateX25519KeyPair,
    generateEd25519KeyPair,
    generateSymmetricKey,
    generateRegistrationId,
    generateKeyId,
    exportPublicKey,
    exportPrivateKey,
    importX25519PublicKey,
    importX25519PrivateKey,
    importEd25519PublicKey,
    importEd25519PrivateKey,
    x25519,
    sign,
    verify,
    hkdf,
    deriveKeys,
    hmacSha256,
    aesGcmEncrypt,
    aesGcmDecrypt,
    concat,
    toBase64,
    fromBase64,
    toHex,
    fromHex,
    constantTimeEqual,
    sha256,
    generateFingerprint,
} from './utils';
