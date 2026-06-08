/**
 * E2E Crypto Service
 * 
 * High-level API for end-to-end encryption in the chat application.
 * This service manages key lifecycle, session creation, and message encryption/decryption.
 */

import {
    generateFullKeyBundle,
    generateSignedPreKey,
    generateOneTimePreKeys,
    parseReceivedKeyBundle,
    x3dhInitiate,
    x3dhRespond,
    createX3DHHeader,
    serializeX3DHHeader,
    deserializeX3DHHeader,
    type IdentityKeyPair,
    type SignedPreKey,
    type OneTimePreKey,
    type ReceivedKeyBundle,
    type PublicKeyBundle,
} from './x3dh';

import {
    initializeSessionAsInitiator,
    initializeSessionAsResponder,
    encrypt as ratchetEncrypt,
    decrypt as ratchetDecrypt,
    serializeEncryptedMessage,
    deserializeEncryptedMessage,
    type SessionState,
} from './doubleRatchet';

import {
    storeIdentityKeyPair,
    getIdentityKeyPair,
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
} from './keyStore';

import {
    toBase64,
    fromBase64,
    concat,
    generateFingerprint,
} from './utils';

import axios from 'axios';
// ============================================
// TYPES
// ============================================

export interface E2EConfig {
    apiUrl: string;
    token: string;
    userId: number;
}

export interface EncryptedPayload {
    version: number;          // Protocol version
    isInitialMessage: boolean; // Whether this includes X3DH header
    x3dhHeader?: string;      // Base64 encoded X3DH header (for initial messages)
    message: string;          // Base64 encoded encrypted message
}

export interface E2EStatus {
    initialized: boolean;
    enabled: boolean;
    registrationId?: number;
    identityFingerprint?: string;
    availablePrekeys: number;
    needsPrekeyRefill: boolean;
    signedPrekeyAge?: number;
    needsSignedPrekeyRotation: boolean;
}

// ============================================
// E2E CRYPTO SERVICE CLASS
// ============================================

class E2ECryptoService {
    private config: E2EConfig | null = null;
    private identityKeyPair: IdentityKeyPair | null = null;
    private signedPreKey: SignedPreKey | null = null;
    private registrationId: number | null = null;
    private initialized = false;

    // Cache for sessions to avoid IndexedDB lookups
    private sessionCache: Map<string, SessionState> = new Map();

    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Initialize the E2E crypto service
     */
    async initialize(config: E2EConfig): Promise<void> {
        this.config = config;

        // Load existing keys from IndexedDB
        this.identityKeyPair = await getIdentityKeyPair();
        this.signedPreKey = await getCurrentSignedPreKey();
        this.registrationId = await getMetadata<number>('registrationId');

        // Load all sessions into cache
        const sessions = await getAllSessions();
        for (const { peerUserId, roomId, state } of sessions) {
            const key = this.getSessionCacheKey(peerUserId, roomId);
            this.sessionCache.set(key, state);
        }

        this.initialized = true;

        // Check if we need to refill prekeys
        await this.checkAndRefillPrekeys();

        // Check if signed prekey needs rotation
        await this.checkAndRotateSignedPrekey();
    }

    /**
     * Check if E2E is enabled for this user
     */
    isEnabled(): boolean {
        return this.initialized && this.identityKeyPair !== null;
    }

    /**
     * Get E2E status
     */
    async getStatus(): Promise<E2EStatus> {
        const availablePrekeys = await countUnusedOneTimePreKeys();
        const signedPrekeyAge = this.signedPreKey 
            ? Date.now() - this.signedPreKey.timestamp 
            : undefined;

        let identityFingerprint: string | undefined;
        if (this.identityKeyPair) {
            identityFingerprint = await generateFingerprint(this.identityKeyPair.publicKey);
        }

        return {
            initialized: this.initialized,
            enabled: this.isEnabled(),
            registrationId: this.registrationId ?? undefined,
            identityFingerprint,
            availablePrekeys,
            needsPrekeyRefill: availablePrekeys < 25,
            signedPrekeyAge,
            needsSignedPrekeyRotation: signedPrekeyAge ? signedPrekeyAge > 7 * 24 * 60 * 60 * 1000 : false,
        };
    }

    // ============================================
    // KEY REGISTRATION
    // ============================================

    /**
     * Enable E2E encryption for this user
     * Generates keys and uploads public bundle to server
     */
    async enableE2E(): Promise<void> {
        if (!this.config) throw new Error('E2E service not initialized');
        if (this.identityKeyPair) throw new Error('E2E already enabled');

        console.log('Generating E2E key bundle...');

        // Generate full key bundle
        const {
            identityKeyPair,
            signedPreKey,
            oneTimePreKeys,
            registrationId,
            publicBundle,
        } = await generateFullKeyBundle();

        // Store private keys locally
        await storeIdentityKeyPair(identityKeyPair, this.config.userId);
        await storeSignedPreKey(signedPreKey);
        await storeOneTimePreKeys(oneTimePreKeys);
        await storeMetadata('registrationId', registrationId);

        // Upload public bundle to server
        await this.uploadKeyBundle(publicBundle);

        // Update local state
        this.identityKeyPair = identityKeyPair;
        this.signedPreKey = signedPreKey;
        this.registrationId = registrationId;

        console.log('E2E encryption enabled successfully');
    }

    /**
     * Upload key bundle to server
     */
    private async uploadKeyBundle(bundle: PublicKeyBundle): Promise<void> {
        if (!this.config) throw new Error('E2E service not initialized');

        await axios.post(
            `${this.config.apiUrl}/e2e/keys/register`,
            {
                identityPublicKey: bundle.identityPublicKey,
                signedPrekeyPublic: bundle.signedPreKeyPublic,
                signedPrekeyId: bundle.signedPreKeyId,
                signedPrekeySignature: bundle.signedPreKeySignature,
                registrationId: bundle.registrationId,
                oneTimePrekeys: bundle.oneTimePreKeys,
            },
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );
    }

    /**
     * Get another user's key bundle from server
     */
    private async fetchKeyBundle(userId: number): Promise<ReceivedKeyBundle | null> {
        if (!this.config) throw new Error('E2E service not initialized');

        try {
            const response = await axios.get(
                `${this.config.apiUrl}/e2e/keys/${userId}`,
                {
                    headers: { Authorization: `Bearer ${this.config.token}` },
                }
            );

            if (!response.data.e2eEnabled) {
                return null;
            }

            return parseReceivedKeyBundle(userId, response.data);
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Check if a user has E2E enabled
     */
    async isUserE2EEnabled(userId: number): Promise<boolean> {
        if (!this.config) return false;

        try {
            const response = await axios.get(
                `${this.config.apiUrl}/e2e/keys/check/${userId}`,
                {
                    headers: { Authorization: `Bearer ${this.config.token}` },
                }
            );
            return response.data.e2eEnabled;
        } catch {
            return false;
        }
    }

    // ============================================
    // KEY MAINTENANCE
    // ============================================

    /**
     * Check and refill one-time prekeys if needed
     */
    private async checkAndRefillPrekeys(): Promise<void> {
        if (!this.config || !this.identityKeyPair) return;

        const count = await countUnusedOneTimePreKeys();
        if (count >= 25) return;

        console.log(`Refilling prekeys (current: ${count})`);

        // Generate more prekeys
        const highestId = await getHighestPreKeyId();
        const newPrekeys = await generateOneTimePreKeys(highestId + 1, 100 - count);

        // Store locally
        await storeOneTimePreKeys(newPrekeys);

        // Upload to server
        await axios.post(
            `${this.config.apiUrl}/e2e/prekeys`,
            {
                prekeys: newPrekeys.map(pk => ({
                    keyId: pk.keyId,
                    publicKey: toBase64(pk.publicKey),
                })),
            },
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );

        console.log(`Uploaded ${newPrekeys.length} new prekeys`);
    }

    /**
     * Check and rotate signed prekey if needed (every 7 days)
     */
    private async checkAndRotateSignedPrekey(): Promise<void> {
        if (!this.config || !this.identityKeyPair || !this.signedPreKey) return;

        const age = Date.now() - this.signedPreKey.timestamp;
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        if (age < sevenDays) return;

        console.log('Rotating signed prekey...');

        // Generate new signed prekey
        const newSignedPreKey = await generateSignedPreKey(
            this.identityKeyPair.signingPrivateKey,
            this.signedPreKey.keyId + 1
        );

        // Store locally
        await storeSignedPreKey(newSignedPreKey);

        // Upload to server
        await axios.put(
            `${this.config.apiUrl}/e2e/keys/signed-prekey`,
            {
                signedPrekeyPublic: toBase64(newSignedPreKey.publicKey),
                signedPrekeyId: newSignedPreKey.keyId,
                signedPrekeySignature: toBase64(newSignedPreKey.signature),
            },
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );

        this.signedPreKey = newSignedPreKey;
        console.log('Signed prekey rotated successfully');
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    private getSessionCacheKey(peerUserId: number, roomId?: number): string {
        return roomId ? `${peerUserId}_${roomId}` : `${peerUserId}`;
    }

    /**
     * Get or create a session with another user
     */
    private async getOrCreateSession(peerUserId: number, roomId?: number): Promise<{
        session: SessionState;
        isNew: boolean;
        x3dhHeader?: Uint8Array;
    }> {
        if (!this.identityKeyPair) throw new Error('E2E not enabled');

        const cacheKey = this.getSessionCacheKey(peerUserId, roomId);

        // Check cache first
        const cached = this.sessionCache.get(cacheKey);
        if (cached) {
            return { session: cached, isNew: false };
        }

        // Check IndexedDB
        const stored = await getSession(peerUserId, roomId);
        if (stored) {
            this.sessionCache.set(cacheKey, stored);
            return { session: stored, isNew: false };
        }

        // Create new session via X3DH
        console.log(`Creating new E2E session with user ${peerUserId}`);

        const peerKeyBundle = await this.fetchKeyBundle(peerUserId);
        if (!peerKeyBundle) {
            throw new Error('Peer does not have E2E enabled');
        }

        // Perform X3DH key agreement
        const x3dhResult = await x3dhInitiate(this.identityKeyPair, peerKeyBundle);

        // Initialize Double Ratchet session
        const session = await initializeSessionAsInitiator(
            x3dhResult.sharedSecret,
            peerKeyBundle.identityPublicKey,
            this.identityKeyPair.publicKey,
            peerKeyBundle.signedPreKeyPublic
        );

        // Create X3DH header for initial message
        const x3dhHeader = serializeX3DHHeader(createX3DHHeader(
            this.identityKeyPair.publicKey,
            x3dhResult.ephemeralPublicKey,
            peerKeyBundle.signedPreKeyId,
            x3dhResult.usedOneTimePreKeyId
        ));

        // Store session
        await storeSession(peerUserId, session, roomId);
        this.sessionCache.set(cacheKey, session);

        return { session, isNew: true, x3dhHeader };
    }

    /**
     * Handle receiving an initial message with X3DH header
     */
    private async handleX3DHHeader(
        peerUserId: number,
        x3dhHeaderBytes: Uint8Array,
        roomId?: number
    ): Promise<SessionState> {
        if (!this.identityKeyPair || !this.signedPreKey) {
            throw new Error('E2E not enabled');
        }

        const header = deserializeX3DHHeader(x3dhHeaderBytes);

        // Get the signed prekey that was used
        const signedPreKey = await getSignedPreKey(header.recipientSignedPreKeyId);
        if (!signedPreKey) {
            throw new Error('Signed prekey not found');
        }

        // Get one-time prekey if used
        let oneTimePreKey: OneTimePreKey | undefined;
        if (header.recipientOneTimePreKeyId !== undefined) {
            oneTimePreKey = await getOneTimePreKey(header.recipientOneTimePreKeyId) ?? undefined;
            if (oneTimePreKey) {
                await markOneTimePreKeyUsed(header.recipientOneTimePreKeyId);
            }
        }

        // Perform X3DH key agreement as responder
        const sharedSecret = await x3dhRespond(
            this.identityKeyPair,
            signedPreKey,
            oneTimePreKey,
            header
        );

        // Initialize session as responder
        const session = await initializeSessionAsResponder(
            sharedSecret,
            header.senderIdentityKey,
            this.identityKeyPair.publicKey,
            {
                publicKey: signedPreKey.publicKey,
                privateKey: signedPreKey.privateKey,
            }
        );

        // Store session
        const cacheKey = this.getSessionCacheKey(peerUserId, roomId);
        await storeSession(peerUserId, session, roomId);
        this.sessionCache.set(cacheKey, session);

        // Refill prekeys if needed
        await this.checkAndRefillPrekeys();

        return session;
    }

    // ============================================
    // ENCRYPTION / DECRYPTION
    // ============================================

    /**
     * Encrypt a message for a specific user
     */
    async encryptMessage(
        peerUserId: number,
        plaintext: string,
        roomId?: number
    ): Promise<EncryptedPayload> {
        if (!this.isEnabled()) {
            throw new Error('E2E encryption not enabled');
        }

        // Get or create session
        const { session, isNew, x3dhHeader } = await this.getOrCreateSession(peerUserId, roomId);

        // Encrypt the message
        const plaintextBytes = new TextEncoder().encode(plaintext);
        const encryptedMessage = await ratchetEncrypt(session, plaintextBytes);
        const messageBytes = serializeEncryptedMessage(encryptedMessage);

        // Update stored session
        const cacheKey = this.getSessionCacheKey(peerUserId, roomId);
        await storeSession(peerUserId, session, roomId);
        this.sessionCache.set(cacheKey, session);

        // Build payload
        const payload: EncryptedPayload = {
            version: 1,
            isInitialMessage: isNew,
            message: toBase64(messageBytes),
        };

        if (isNew && x3dhHeader) {
            payload.x3dhHeader = toBase64(x3dhHeader);
        }

        return payload;
    }

    /**
     * Decrypt a message from a specific user
     */
    async decryptMessage(
        peerUserId: number,
        payload: EncryptedPayload,
        roomId?: number
    ): Promise<string> {
        if (!this.isEnabled()) {
            throw new Error('E2E encryption not enabled');
        }

        const cacheKey = this.getSessionCacheKey(peerUserId, roomId);
        let session = this.sessionCache.get(cacheKey) || await getSession(peerUserId, roomId);

        // Handle initial message with X3DH header
        if (payload.isInitialMessage && payload.x3dhHeader) {
            const x3dhHeaderBytes = fromBase64(payload.x3dhHeader);
            session = await this.handleX3DHHeader(peerUserId, x3dhHeaderBytes, roomId);
        }

        if (!session) {
            throw new Error('No session found with peer');
        }

        // Decrypt the message
        const messageBytes = fromBase64(payload.message);
        const encryptedMessage = deserializeEncryptedMessage(messageBytes);
        const plaintextBytes = await ratchetDecrypt(session, encryptedMessage);

        // Update stored session
        await storeSession(peerUserId, session, roomId);
        this.sessionCache.set(cacheKey, session);

        return new TextDecoder().decode(plaintextBytes);
    }

    // ============================================
    // VERIFICATION
    // ============================================

    /**
     * Get safety number for verifying a conversation
     * This can be displayed as a QR code or compared manually
     */
    async getSafetyNumber(peerUserId: number): Promise<string> {
        if (!this.identityKeyPair) throw new Error('E2E not enabled');

        const peerKeyBundle = await this.fetchKeyBundle(peerUserId);
        if (!peerKeyBundle) {
            throw new Error('Peer does not have E2E enabled');
        }

        // Combine both identity keys (sorted for consistency)
        const keys = [
            { userId: this.config!.userId, key: this.identityKeyPair.publicKey },
            { userId: peerUserId, key: peerKeyBundle.identityPublicKey },
        ].sort((a, b) => a.userId - b.userId);

        const combined = concat(keys[0].key, keys[1].key);
        return await generateFingerprint(combined);
    }

    /**
     * Get your own identity key fingerprint
     */
    async getOwnFingerprint(): Promise<string | null> {
        if (!this.identityKeyPair) return null;
        return await generateFingerprint(this.identityKeyPair.publicKey);
    }

    // ============================================
    // CLEANUP
    // ============================================

    /**
     * Reset all E2E data (dangerous!)
     */
    async resetE2E(): Promise<void> {
        await clearAllData();
        this.identityKeyPair = null;
        this.signedPreKey = null;
        this.registrationId = null;
        this.sessionCache.clear();
        console.log('E2E data cleared');
    }

    /**
     * Delete a specific session
     */
    async deleteSessionWith(peerUserId: number, roomId?: number): Promise<void> {
        const cacheKey = this.getSessionCacheKey(peerUserId, roomId);
        await deleteSession(peerUserId, roomId);
        this.sessionCache.delete(cacheKey);
    }
}

// Export singleton instance
export const e2eCryptoService = new E2ECryptoService();
export default e2eCryptoService;
