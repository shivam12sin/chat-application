/**
 * E2E Crypto Utilities
 * 
 * Low-level cryptographic operations using Web Crypto API.
 * This module provides the primitives for the Signal Protocol implementation.
 */

// ============================================
// HELPER: Convert Uint8Array to BufferSource for crypto.subtle
// TypeScript is strict about ArrayBufferLike vs ArrayBuffer
// ============================================

function toBuffer(bytes: Uint8Array): ArrayBuffer {
    // Create a new ArrayBuffer with just the relevant slice
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return copy.buffer as ArrayBuffer;
}

// ============================================
// KEY GENERATION
// ============================================

/**
 * Generate an X25519 key pair for key exchange
 */
export async function generateX25519KeyPair(): Promise<CryptoKeyPair> {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: 'X25519',
        },
        true, // extractable
        ['deriveBits']
    ) as CryptoKeyPair;
    return keyPair;
}

/**
 * Generate an Ed25519 key pair for signatures
 */
export async function generateEd25519KeyPair(): Promise<CryptoKeyPair> {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: 'Ed25519',
        },
        true, // extractable
        ['sign', 'verify']
    ) as CryptoKeyPair;
    return keyPair;
}

/**
 * Generate a random 32-byte symmetric key
 */
export function generateSymmetricKey(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Generate a random registration ID (16-bit)
 */
export function generateRegistrationId(): number {
    const arr = crypto.getRandomValues(new Uint8Array(2));
    return (arr[0] << 8) | arr[1];
}

/**
 * Generate a random key ID
 */
export function generateKeyId(): number {
    const arr = crypto.getRandomValues(new Uint8Array(4));
    return ((arr[0] << 24) | (arr[1] << 16) | (arr[2] << 8) | arr[3]) >>> 0;
}

// ============================================
// KEY IMPORT/EXPORT
// ============================================

/**
 * Export a public key to raw bytes
 */
export async function exportPublicKey(key: CryptoKey): Promise<Uint8Array> {
    const exported = await crypto.subtle.exportKey('raw', key);
    return new Uint8Array(exported);
}

/**
 * Export a private key to PKCS8 format
 */
export async function exportPrivateKey(key: CryptoKey): Promise<Uint8Array> {
    const exported = await crypto.subtle.exportKey('pkcs8', key);
    return new Uint8Array(exported);
}

/**
 * Import a public X25519 key from raw bytes
 */
export async function importX25519PublicKey(bytes: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'raw',
        toBuffer(bytes),
        { name: 'X25519' },
        true,
        []
    );
}

/**
 * Import a private X25519 key from PKCS8 format
 */
export async function importX25519PrivateKey(bytes: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'pkcs8',
        toBuffer(bytes),
        { name: 'X25519' },
        true,
        ['deriveBits']
    );
}

/**
 * Import a public Ed25519 key from raw bytes
 */
export async function importEd25519PublicKey(bytes: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'raw',
        toBuffer(bytes),
        { name: 'Ed25519' },
        true,
        ['verify']
    );
}

/**
 * Import a private Ed25519 key from PKCS8 format
 */
export async function importEd25519PrivateKey(bytes: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'pkcs8',
        toBuffer(bytes),
        { name: 'Ed25519' },
        true,
        ['sign']
    );
}

// ============================================
// ECDH KEY AGREEMENT
// ============================================

/**
 * Perform X25519 key agreement (ECDH)
 */
export async function x25519(privateKey: CryptoKey, publicKey: CryptoKey): Promise<Uint8Array> {
    const bits = await crypto.subtle.deriveBits(
        {
            name: 'X25519',
            public: publicKey,
        },
        privateKey,
        256
    );
    return new Uint8Array(bits);
}

// ============================================
// SIGNATURES
// ============================================

/**
 * Sign data with Ed25519
 */
export async function sign(privateKey: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
    const signature = await crypto.subtle.sign(
        { name: 'Ed25519' },
        privateKey,
        toBuffer(data)
    );
    return new Uint8Array(signature);
}

/**
 * Verify an Ed25519 signature
 */
export async function verify(publicKey: CryptoKey, signature: Uint8Array, data: Uint8Array): Promise<boolean> {
    return await crypto.subtle.verify(
        { name: 'Ed25519' },
        publicKey,
        toBuffer(signature),
        toBuffer(data)
    );
}

// ============================================
// HKDF (Key Derivation)
// ============================================

/**
 * Derive keys using HKDF-SHA-256
 */
export async function hkdf(
    inputKeyMaterial: Uint8Array,
    salt: Uint8Array,
    info: Uint8Array,
    length: number
): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
        'raw',
        toBuffer(inputKeyMaterial),
        { name: 'HKDF' },
        false,
        ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: toBuffer(salt),
            info: toBuffer(info),
        },
        key,
        length * 8
    );

    return new Uint8Array(bits);
}

/**
 * Derive multiple keys from HKDF output
 */
export async function deriveKeys(
    sharedSecret: Uint8Array,
    salt: Uint8Array,
    info: string,
    keyLengths: number[]
): Promise<Uint8Array[]> {
    const totalLength = keyLengths.reduce((a, b) => a + b, 0);
    const derived = await hkdf(
        sharedSecret,
        salt,
        new TextEncoder().encode(info),
        totalLength
    );

    const keys: Uint8Array[] = [];
    let offset = 0;
    for (const length of keyLengths) {
        keys.push(derived.slice(offset, offset + length));
        offset += length;
    }

    return keys;
}

// ============================================
// HMAC
// ============================================

/**
 * Compute HMAC-SHA-256
 */
export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        toBuffer(key),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, toBuffer(data));
    return new Uint8Array(signature);
}

// ============================================
// AES-GCM ENCRYPTION
// ============================================

/**
 * Encrypt data using AES-256-GCM
 */
export async function aesGcmEncrypt(
    plaintext: Uint8Array,
    key: Uint8Array,
    associatedData?: Uint8Array
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
    const nonce = crypto.getRandomValues(new Uint8Array(12)); // 96-bit nonce

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        toBuffer(key),
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: toBuffer(nonce),
            additionalData: associatedData ? toBuffer(associatedData) : undefined,
            tagLength: 128, // 16 bytes authentication tag
        },
        cryptoKey,
        toBuffer(plaintext)
    );

    return {
        ciphertext: new Uint8Array(encrypted),
        nonce,
    };
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function aesGcmDecrypt(
    ciphertext: Uint8Array,
    key: Uint8Array,
    nonce: Uint8Array,
    associatedData?: Uint8Array
): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        toBuffer(key),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: toBuffer(nonce),
            additionalData: associatedData ? toBuffer(associatedData) : undefined,
            tagLength: 128,
        },
        cryptoKey,
        toBuffer(ciphertext)
    );

    return new Uint8Array(decrypted);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Concatenate multiple Uint8Arrays
 */
export function concat(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

/**
 * Convert Uint8Array to base64
 */
export function toBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, Array.from(bytes)));
}

/**
 * Convert base64 to Uint8Array
 */
export function fromBase64(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Convert hex string to Uint8Array
 */
export function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

/**
 * Compare two Uint8Arrays for equality (constant-time)
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a[i] ^ b[i];
    }
    return result === 0;
}

/**
 * Hash data using SHA-256
 */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
    const hash = await crypto.subtle.digest('SHA-256', toBuffer(data));
    return new Uint8Array(hash);
}

/**
 * Generate a fingerprint for a public key (for verification UI)
 */
export async function generateFingerprint(publicKey: Uint8Array): Promise<string> {
    const hash = await sha256(publicKey);
    // Format as groups of 5 hex digits separated by spaces
    const hex = toHex(hash.slice(0, 30)); // Use first 30 bytes = 60 hex chars = 12 groups
    const groups: string[] = [];
    for (let i = 0; i < hex.length; i += 5) {
        groups.push(hex.slice(i, i + 5));
    }
    return groups.join(' ');
}
