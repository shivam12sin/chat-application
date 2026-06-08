/**
 * X3DH (Extended Triple Diffie-Hellman) Key Agreement Protocol
 * 
 * This implements the Signal Protocol's X3DH key agreement.
 * X3DH provides forward secrecy and cryptographic deniability.
 * 
 * Reference: https://signal.org/docs/specifications/x3dh/
 */

import {
    generateX25519KeyPair,
    generateEd25519KeyPair,
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
    concat,
    toBase64,
    fromBase64,
    generateKeyId,
    generateRegistrationId,
} from './utils';

// ============================================
// TYPES
// ============================================

/**
 * Identity key pair (long-term, changes only on account reset)
 */
export interface IdentityKeyPair {
    publicKey: Uint8Array;      // X25519 public key (32 bytes)
    privateKey: Uint8Array;     // X25519 private key (PKCS8)
    signingPublicKey: Uint8Array;  // Ed25519 public key for signing (32 bytes)
    signingPrivateKey: Uint8Array; // Ed25519 private key (PKCS8)
}

/**
 * Signed pre-key (medium-term, rotates every 7-30 days)
 */
export interface SignedPreKey {
    keyId: number;
    publicKey: Uint8Array;      // X25519 public key
    privateKey: Uint8Array;     // X25519 private key
    signature: Uint8Array;      // Ed25519 signature of publicKey
    timestamp: number;
}

/**
 * One-time pre-key (single use)
 */
export interface OneTimePreKey {
    keyId: number;
    publicKey: Uint8Array;      // X25519 public key
    privateKey: Uint8Array;     // X25519 private key
}

/**
 * Public key bundle (what gets uploaded to server)
 */
export interface PublicKeyBundle {
    registrationId: number;
    identityPublicKey: string;  // base64
    signedPreKeyId: number;
    signedPreKeyPublic: string; // base64
    signedPreKeySignature: string; // base64
    oneTimePreKeys: Array<{
        keyId: number;
        publicKey: string;      // base64
    }>;
}

/**
 * Received key bundle from another user
 */
export interface ReceivedKeyBundle {
    userId: number;
    registrationId: number;
    identityPublicKey: Uint8Array;
    signedPreKeyPublic: Uint8Array;
    signedPreKeyId: number;
    signedPreKeySignature: Uint8Array;
    oneTimePreKey?: {
        keyId: number;
        publicKey: Uint8Array;
    };
}

/**
 * X3DH key agreement result
 */
export interface X3DHResult {
    sharedSecret: Uint8Array;   // 32-byte shared secret
    ephemeralPublicKey: Uint8Array; // To send to recipient
    usedOneTimePreKeyId?: number;   // Which one-time prekey was used
}

/**
 * X3DH initial message header
 */
export interface X3DHHeader {
    senderIdentityKey: Uint8Array;
    senderEphemeralKey: Uint8Array;
    recipientSignedPreKeyId: number;
    recipientOneTimePreKeyId?: number;
}

// ============================================
// KEY GENERATION
// ============================================

/**
 * Generate a new identity key pair
 * This should only be done once per account
 */
export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
    // X25519 for key exchange
    const ecdhKeyPair = await generateX25519KeyPair();
    const publicKey = await exportPublicKey(ecdhKeyPair.publicKey);
    const privateKey = await exportPrivateKey(ecdhKeyPair.privateKey);

    // Ed25519 for signing
    const signingKeyPair = await generateEd25519KeyPair();
    const signingPublicKey = await exportPublicKey(signingKeyPair.publicKey);
    const signingPrivateKey = await exportPrivateKey(signingKeyPair.privateKey);

    return {
        publicKey,
        privateKey,
        signingPublicKey,
        signingPrivateKey,
    };
}

/**
 * Generate a new signed pre-key
 * Sign the public key with the identity signing key
 */
export async function generateSignedPreKey(
    identitySigningPrivateKey: Uint8Array,
    keyId?: number
): Promise<SignedPreKey> {
    const keyPair = await generateX25519KeyPair();
    const publicKey = await exportPublicKey(keyPair.publicKey);
    const privateKey = await exportPrivateKey(keyPair.privateKey);

    // Sign the public key
    const signingKey = await importEd25519PrivateKey(identitySigningPrivateKey);
    const signature = await sign(signingKey, publicKey);

    return {
        keyId: keyId ?? generateKeyId(),
        publicKey,
        privateKey,
        signature,
        timestamp: Date.now(),
    };
}

/**
 * Generate a batch of one-time pre-keys
 */
export async function generateOneTimePreKeys(
    startKeyId: number,
    count: number
): Promise<OneTimePreKey[]> {
    const preKeys: OneTimePreKey[] = [];

    for (let i = 0; i < count; i++) {
        const keyPair = await generateX25519KeyPair();
        preKeys.push({
            keyId: startKeyId + i,
            publicKey: await exportPublicKey(keyPair.publicKey),
            privateKey: await exportPrivateKey(keyPair.privateKey),
        });
    }

    return preKeys;
}

// ============================================
// KEY BUNDLE OPERATIONS
// ============================================

/**
 * Create a public key bundle for upload to server
 */
export function createPublicKeyBundle(
    registrationId: number,
    identityKeyPair: IdentityKeyPair,
    signedPreKey: SignedPreKey,
    oneTimePreKeys: OneTimePreKey[]
): PublicKeyBundle {
    return {
        registrationId,
        identityPublicKey: toBase64(identityKeyPair.publicKey),
        signedPreKeyId: signedPreKey.keyId,
        signedPreKeyPublic: toBase64(signedPreKey.publicKey),
        signedPreKeySignature: toBase64(signedPreKey.signature),
        oneTimePreKeys: oneTimePreKeys.map(pk => ({
            keyId: pk.keyId,
            publicKey: toBase64(pk.publicKey),
        })),
    };
}

/**
 * Parse a received key bundle from the server
 */
export function parseReceivedKeyBundle(
    userId: number,
    bundle: {
        registrationId: number;
        identityPublicKey: string;
        signedPrekeyPublic: string;
        signedPrekeyId: number;
        signedPrekeySignature: string;
        oneTimePrekey?: { keyId: number; publicKey: string };
    }
): ReceivedKeyBundle {
    return {
        userId,
        registrationId: bundle.registrationId,
        identityPublicKey: fromBase64(bundle.identityPublicKey),
        signedPreKeyPublic: fromBase64(bundle.signedPrekeyPublic),
        signedPreKeyId: bundle.signedPrekeyId,
        signedPreKeySignature: fromBase64(bundle.signedPrekeySignature),
        oneTimePreKey: bundle.oneTimePrekey ? {
            keyId: bundle.oneTimePrekey.keyId,
            publicKey: fromBase64(bundle.oneTimePrekey.publicKey),
        } : undefined,
    };
}

// ============================================
// X3DH KEY AGREEMENT
// ============================================

/**
 * Perform X3DH key agreement as the initiator (sender)
 * 
 * This is called when Alice wants to send a message to Bob.
 * Alice fetches Bob's key bundle and performs X3DH to derive a shared secret.
 */
export async function x3dhInitiate(
    senderIdentityKeyPair: IdentityKeyPair,
    recipientKeyBundle: ReceivedKeyBundle
): Promise<X3DHResult> {
    // Verify the signed prekey signature
    const recipientIdentityKey = await importEd25519PublicKey(recipientKeyBundle.identityPublicKey);
    const isValid = await verify(
        recipientIdentityKey,
        recipientKeyBundle.signedPreKeySignature,
        recipientKeyBundle.signedPreKeyPublic
    );

    if (!isValid) {
        throw new Error('Invalid signed prekey signature');
    }

    // Generate ephemeral key pair
    const ephemeralKeyPair = await generateX25519KeyPair();
    const ephemeralPublicKey = await exportPublicKey(ephemeralKeyPair.publicKey);

    // Import keys for DH operations
    const senderIdentityPrivate = await importX25519PrivateKey(senderIdentityKeyPair.privateKey);
    const recipientIdentityPublic = await importX25519PublicKey(recipientKeyBundle.identityPublicKey);
    const recipientSignedPreKeyPublic = await importX25519PublicKey(recipientKeyBundle.signedPreKeyPublic);

    // DH1: sender_identity_private × recipient_signed_prekey_public
    const dh1 = await x25519(senderIdentityPrivate, recipientSignedPreKeyPublic);

    // DH2: sender_ephemeral_private × recipient_identity_public
    const dh2 = await x25519(ephemeralKeyPair.privateKey, recipientIdentityPublic);

    // DH3: sender_ephemeral_private × recipient_signed_prekey_public
    const dh3 = await x25519(ephemeralKeyPair.privateKey, recipientSignedPreKeyPublic);

    // DH4 (optional): sender_ephemeral_private × recipient_one_time_prekey_public
    let dh4: Uint8Array | null = null;
    if (recipientKeyBundle.oneTimePreKey) {
        const oneTimePreKeyPublic = await importX25519PublicKey(recipientKeyBundle.oneTimePreKey.publicKey);
        dh4 = await x25519(ephemeralKeyPair.privateKey, oneTimePreKeyPublic);
    }

    // Combine DH outputs
    const dhConcat = dh4 
        ? concat(dh1, dh2, dh3, dh4) 
        : concat(dh1, dh2, dh3);

    // Derive shared secret using HKDF
    // Salt should be 32 zero bytes as per Signal spec
    const salt = new Uint8Array(32);
    const info = new TextEncoder().encode('X3DH');
    const sharedSecret = await hkdf(dhConcat, salt, info, 32);

    return {
        sharedSecret,
        ephemeralPublicKey,
        usedOneTimePreKeyId: recipientKeyBundle.oneTimePreKey?.keyId,
    };
}

/**
 * Perform X3DH key agreement as the responder (recipient)
 * 
 * This is called when Bob receives an initial message from Alice.
 * Bob uses the X3DH header to derive the same shared secret.
 */
export async function x3dhRespond(
    recipientIdentityKeyPair: IdentityKeyPair,
    recipientSignedPreKey: SignedPreKey,
    recipientOneTimePreKey: OneTimePreKey | undefined,
    header: X3DHHeader
): Promise<Uint8Array> {
    // Import keys for DH operations
    const recipientIdentityPrivate = await importX25519PrivateKey(recipientIdentityKeyPair.privateKey);
    const recipientSignedPreKeyPrivate = await importX25519PrivateKey(recipientSignedPreKey.privateKey);
    const senderIdentityPublic = await importX25519PublicKey(header.senderIdentityKey);
    const senderEphemeralPublic = await importX25519PublicKey(header.senderEphemeralKey);

    // DH1: recipient_signed_prekey_private × sender_identity_public
    const dh1 = await x25519(recipientSignedPreKeyPrivate, senderIdentityPublic);

    // DH2: recipient_identity_private × sender_ephemeral_public
    const dh2 = await x25519(recipientIdentityPrivate, senderEphemeralPublic);

    // DH3: recipient_signed_prekey_private × sender_ephemeral_public
    const dh3 = await x25519(recipientSignedPreKeyPrivate, senderEphemeralPublic);

    // DH4 (optional): recipient_one_time_prekey_private × sender_ephemeral_public
    let dh4: Uint8Array | null = null;
    if (recipientOneTimePreKey && header.recipientOneTimePreKeyId !== undefined) {
        const oneTimePreKeyPrivate = await importX25519PrivateKey(recipientOneTimePreKey.privateKey);
        dh4 = await x25519(oneTimePreKeyPrivate, senderEphemeralPublic);
    }

    // Combine DH outputs (same order as initiator)
    const dhConcat = dh4 
        ? concat(dh1, dh2, dh3, dh4) 
        : concat(dh1, dh2, dh3);

    // Derive shared secret using HKDF
    const salt = new Uint8Array(32);
    const info = new TextEncoder().encode('X3DH');
    const sharedSecret = await hkdf(dhConcat, salt, info, 32);

    return sharedSecret;
}

/**
 * Create X3DH header to send with initial message
 */
export function createX3DHHeader(
    senderIdentityPublicKey: Uint8Array,
    senderEphemeralPublicKey: Uint8Array,
    recipientSignedPreKeyId: number,
    recipientOneTimePreKeyId?: number
): X3DHHeader {
    return {
        senderIdentityKey: senderIdentityPublicKey,
        senderEphemeralKey: senderEphemeralPublicKey,
        recipientSignedPreKeyId,
        recipientOneTimePreKeyId,
    };
}

/**
 * Serialize X3DH header for transmission
 */
export function serializeX3DHHeader(header: X3DHHeader): Uint8Array {
    // Format: [identityKey(32) | ephemeralKey(32) | signedPreKeyId(4) | oneTimePreKeyId(4) | hasOneTimePreKey(1)]
    const hasOneTimePreKey = header.recipientOneTimePreKeyId !== undefined;
    const buffer = new Uint8Array(32 + 32 + 4 + 4 + 1);
    
    buffer.set(header.senderIdentityKey, 0);
    buffer.set(header.senderEphemeralKey, 32);
    
    // Write signed prekey ID (big-endian)
    const view = new DataView(buffer.buffer);
    view.setUint32(64, header.recipientSignedPreKeyId, false);
    view.setUint32(68, header.recipientOneTimePreKeyId ?? 0, false);
    buffer[72] = hasOneTimePreKey ? 1 : 0;
    
    return buffer;
}

/**
 * Deserialize X3DH header from received data
 */
export function deserializeX3DHHeader(data: Uint8Array): X3DHHeader {
    if (data.length < 73) {
        throw new Error('Invalid X3DH header length');
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const hasOneTimePreKey = data[72] === 1;

    return {
        senderIdentityKey: data.slice(0, 32),
        senderEphemeralKey: data.slice(32, 64),
        recipientSignedPreKeyId: view.getUint32(64, false),
        recipientOneTimePreKeyId: hasOneTimePreKey ? view.getUint32(68, false) : undefined,
    };
}

// ============================================
// FULL KEY BUNDLE GENERATION
// ============================================

/**
 * Generate a complete key bundle for a new user
 */
export async function generateFullKeyBundle(): Promise<{
    identityKeyPair: IdentityKeyPair;
    signedPreKey: SignedPreKey;
    oneTimePreKeys: OneTimePreKey[];
    registrationId: number;
    publicBundle: PublicKeyBundle;
}> {
    // Generate identity key pair
    const identityKeyPair = await generateIdentityKeyPair();
    
    // Generate registration ID
    const registrationId = generateRegistrationId();
    
    // Generate signed prekey
    const signedPreKey = await generateSignedPreKey(identityKeyPair.signingPrivateKey);
    
    // Generate initial batch of one-time prekeys (100)
    const oneTimePreKeys = await generateOneTimePreKeys(1, 100);
    
    // Create public bundle for server upload
    const publicBundle = createPublicKeyBundle(
        registrationId,
        identityKeyPair,
        signedPreKey,
        oneTimePreKeys
    );

    return {
        identityKeyPair,
        signedPreKey,
        oneTimePreKeys,
        registrationId,
        publicBundle,
    };
}
