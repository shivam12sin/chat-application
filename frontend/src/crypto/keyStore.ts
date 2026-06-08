/**
 * E2E Key Store
 * 
 * Secure local storage for cryptographic keys using IndexedDB.
 * All sensitive data is encrypted with a device-derived key before storage.
 */

import {
    aesGcmEncrypt,
    aesGcmDecrypt,
    toBase64,
    fromBase64,
    generateSymmetricKey,
} from './utils';
import type { IdentityKeyPair, SignedPreKey, OneTimePreKey } from './x3dh';
import type { SessionState } from './doubleRatchet';

// ============================================
// DATABASE SETUP
// ============================================

const DB_NAME = 'AetherE2EKeys';
const DB_VERSION = 1;

const STORES = {
    IDENTITY: 'identity',
    SIGNED_PREKEYS: 'signedPrekeys',
    ONE_TIME_PREKEYS: 'oneTimePrekeys',
    SESSIONS: 'sessions',
    DEVICE: 'device',
    METADATA: 'metadata',
} as const;

let db: IDBDatabase | null = null;
let deviceKey: Uint8Array | null = null;

/**
 * Open the IndexedDB database
 */
async function openDatabase(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(new Error('Failed to open E2E key database'));

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // Identity keys store
            if (!database.objectStoreNames.contains(STORES.IDENTITY)) {
                database.createObjectStore(STORES.IDENTITY, { keyPath: 'id' });
            }

            // Signed prekeys store
            if (!database.objectStoreNames.contains(STORES.SIGNED_PREKEYS)) {
                const store = database.createObjectStore(STORES.SIGNED_PREKEYS, { keyPath: 'keyId' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // One-time prekeys store
            if (!database.objectStoreNames.contains(STORES.ONE_TIME_PREKEYS)) {
                const store = database.createObjectStore(STORES.ONE_TIME_PREKEYS, { keyPath: 'keyId' });
                store.createIndex('used', 'used', { unique: false });
            }

            // Sessions store
            if (!database.objectStoreNames.contains(STORES.SESSIONS)) {
                const store = database.createObjectStore(STORES.SESSIONS, { keyPath: 'sessionKey' });
                store.createIndex('peerUserId', 'peerUserId', { unique: false });
                store.createIndex('lastMessageAt', 'lastMessageAt', { unique: false });
            }

            // Device info store
            if (!database.objectStoreNames.contains(STORES.DEVICE)) {
                database.createObjectStore(STORES.DEVICE, { keyPath: 'id' });
            }

            // Metadata store
            if (!database.objectStoreNames.contains(STORES.METADATA)) {
                database.createObjectStore(STORES.METADATA, { keyPath: 'key' });
            }
        };
    });
}

/**
 * Get or create device encryption key
 * This key is used to encrypt all stored cryptographic material
 */
async function getDeviceKey(): Promise<Uint8Array> {
    if (deviceKey) return deviceKey;

    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.DEVICE], 'readwrite');
        const store = transaction.objectStore(STORES.DEVICE);
        const request = store.get('deviceKey');

        request.onerror = () => reject(new Error('Failed to get device key'));

        request.onsuccess = async () => {
            if (request.result) {
                deviceKey = fromBase64(request.result.key);
                resolve(deviceKey);
            } else {
                // Generate new device key
                deviceKey = generateSymmetricKey();
                const putRequest = store.put({
                    id: 'deviceKey',
                    key: toBase64(deviceKey),
                    createdAt: Date.now(),
                });
                putRequest.onerror = () => reject(new Error('Failed to store device key'));
                putRequest.onsuccess = () => resolve(deviceKey!);
            }
        };
    });
}

/**
 * Encrypt data for storage
 */
async function encryptForStorage(data: Uint8Array): Promise<string> {
    const key = await getDeviceKey();
    const { ciphertext, nonce } = await aesGcmEncrypt(data, key);
    return JSON.stringify({
        c: toBase64(ciphertext),
        n: toBase64(nonce),
    });
}

/**
 * Decrypt data from storage
 */
async function decryptFromStorage(encrypted: string): Promise<Uint8Array> {
    const key = await getDeviceKey();
    const { c, n } = JSON.parse(encrypted);
    return await aesGcmDecrypt(fromBase64(c), key, fromBase64(n));
}

// ============================================
// IDENTITY KEY OPERATIONS
// ============================================

/**
 * Store identity key pair
 */
export async function storeIdentityKeyPair(keyPair: IdentityKeyPair, userId: number): Promise<void> {
    const database = await openDatabase();

    const serialized = JSON.stringify({
        publicKey: toBase64(keyPair.publicKey),
        privateKey: toBase64(keyPair.privateKey),
        signingPublicKey: toBase64(keyPair.signingPublicKey),
        signingPrivateKey: toBase64(keyPair.signingPrivateKey),
    });

    const encrypted = await encryptForStorage(new TextEncoder().encode(serialized));

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.IDENTITY], 'readwrite');
        const store = transaction.objectStore(STORES.IDENTITY);

        const request = store.put({
            id: 'identity',
            userId,
            data: encrypted,
            createdAt: Date.now(),
        });

        request.onerror = () => reject(new Error('Failed to store identity key pair'));
        request.onsuccess = () => resolve();
    });
}

/**
 * Get identity key pair
 */
export async function getIdentityKeyPair(): Promise<IdentityKeyPair | null> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.IDENTITY], 'readonly');
        const store = transaction.objectStore(STORES.IDENTITY);
        const request = store.get('identity');

        request.onerror = () => reject(new Error('Failed to get identity key pair'));

        request.onsuccess = async () => {
            if (!request.result) {
                resolve(null);
                return;
            }

            try {
                const decrypted = await decryptFromStorage(request.result.data);
                const parsed = JSON.parse(new TextDecoder().decode(decrypted));
                resolve({
                    publicKey: fromBase64(parsed.publicKey),
                    privateKey: fromBase64(parsed.privateKey),
                    signingPublicKey: fromBase64(parsed.signingPublicKey),
                    signingPrivateKey: fromBase64(parsed.signingPrivateKey),
                });
            } catch (error) {
                console.error('Failed to decrypt identity key pair:', error);
                resolve(null);
            }
        };
    });
}

/**
 * Check if identity key exists
 */
export async function hasIdentityKey(): Promise<boolean> {
    const keyPair = await getIdentityKeyPair();
    return keyPair !== null;
}

// ============================================
// SIGNED PREKEY OPERATIONS
// ============================================

/**
 * Store signed prekey
 */
export async function storeSignedPreKey(preKey: SignedPreKey): Promise<void> {
    const database = await openDatabase();

    const serialized = JSON.stringify({
        keyId: preKey.keyId,
        publicKey: toBase64(preKey.publicKey),
        privateKey: toBase64(preKey.privateKey),
        signature: toBase64(preKey.signature),
        timestamp: preKey.timestamp,
    });

    const encrypted = await encryptForStorage(new TextEncoder().encode(serialized));

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.SIGNED_PREKEYS], 'readwrite');
        const store = transaction.objectStore(STORES.SIGNED_PREKEYS);

        const request = store.put({
            keyId: preKey.keyId,
            data: encrypted,
            timestamp: preKey.timestamp,
        });

        request.onerror = () => reject(new Error('Failed to store signed prekey'));
        request.onsuccess = () => resolve();
    });
}

/**
 * Get signed prekey by ID
 */
export async function getSignedPreKey(keyId: number): Promise<SignedPreKey | null> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.SIGNED_PREKEYS], 'readonly');
        const store = transaction.objectStore(STORES.SIGNED_PREKEYS);
        const request = store.get(keyId);

        request.onerror = () => reject(new Error('Failed to get signed prekey'));

        request.onsuccess = async () => {
            if (!request.result) {
                resolve(null);
                return;
            }

            try {
                const decrypted = await decryptFromStorage(request.result.data);
                const parsed = JSON.parse(new TextDecoder().decode(decrypted));
                resolve({
                    keyId: parsed.keyId,
                    publicKey: fromBase64(parsed.publicKey),
                    privateKey: fromBase64(parsed.privateKey),
                    signature: fromBase64(parsed.signature),
                    timestamp: parsed.timestamp,
                });
            } catch (error) {
                console.error('Failed to decrypt signed prekey:', error);
                resolve(null);
            }
        };
    });
}

/**
 * Get current (latest) signed prekey
 */
export async function getCurrentSignedPreKey(): Promise<SignedPreKey | null> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.SIGNED_PREKEYS], 'readonly');
        const store = transaction.objectStore(STORES.SIGNED_PREKEYS);
        const index = store.index('timestamp');
        const request = index.openCursor(null, 'prev');

        request.onerror = () => reject(new Error('Failed to get current signed prekey'));

        request.onsuccess = async () => {
            const cursor = request.result;
            if (!cursor) {
                resolve(null);
                return;
            }

            try {
                const decrypted = await decryptFromStorage(cursor.value.data);
                const parsed = JSON.parse(new TextDecoder().decode(decrypted));
                resolve({
                    keyId: parsed.keyId,
                    publicKey: fromBase64(parsed.publicKey),
                    privateKey: fromBase64(parsed.privateKey),
                    signature: fromBase64(parsed.signature),
                    timestamp: parsed.timestamp,
                });
            } catch (error) {
                console.error('Failed to decrypt signed prekey:', error);
                resolve(null);
            }
        };
    });
}

// ============================================
// ONE-TIME PREKEY OPERATIONS
// ============================================

/**
 * Store one-time prekeys
 */
export async function storeOneTimePreKeys(preKeys: OneTimePreKey[]): Promise<void> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.ONE_TIME_PREKEYS], 'readwrite');
        const store = transaction.objectStore(STORES.ONE_TIME_PREKEYS);

        let completed = 0;
        let errors = 0;

        for (const preKey of preKeys) {
            const serialized = JSON.stringify({
                keyId: preKey.keyId,
                publicKey: toBase64(preKey.publicKey),
                privateKey: toBase64(preKey.privateKey),
            });

            encryptForStorage(new TextEncoder().encode(serialized)).then((encrypted) => {
                const request = store.put({
                    keyId: preKey.keyId,
                    data: encrypted,
                    used: false,
                    createdAt: Date.now(),
                });

                request.onerror = () => {
                    errors++;
                    if (completed + errors === preKeys.length) {
                        if (errors > 0) reject(new Error(`Failed to store ${errors} prekeys`));
                        else resolve();
                    }
                };

                request.onsuccess = () => {
                    completed++;
                    if (completed + errors === preKeys.length) {
                        if (errors > 0) reject(new Error(`Failed to store ${errors} prekeys`));
                        else resolve();
                    }
                };
            });
        }

        if (preKeys.length === 0) resolve();
    });
}

/**
 * Get one-time prekey by ID
 */
export async function getOneTimePreKey(keyId: number): Promise<OneTimePreKey | null> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.ONE_TIME_PREKEYS], 'readonly');
        const store = transaction.objectStore(STORES.ONE_TIME_PREKEYS);
        const request = store.get(keyId);

        request.onerror = () => reject(new Error('Failed to get one-time prekey'));

        request.onsuccess = async () => {
            if (!request.result) {
                resolve(null);
                return;
            }

            try {
                const decrypted = await decryptFromStorage(request.result.data);
                const parsed = JSON.parse(new TextDecoder().decode(decrypted));
                resolve({
                    keyId: parsed.keyId,
                    publicKey: fromBase64(parsed.publicKey),
                    privateKey: fromBase64(parsed.privateKey),
                });
            } catch (error) {
                console.error('Failed to decrypt one-time prekey:', error);
                resolve(null);
            }
        };
    });
}

/**
 * Mark one-time prekey as used (and delete it)
 */
export async function markOneTimePreKeyUsed(keyId: number): Promise<void> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.ONE_TIME_PREKEYS], 'readwrite');
        const store = transaction.objectStore(STORES.ONE_TIME_PREKEYS);
        const request = store.delete(keyId);

        request.onerror = () => reject(new Error('Failed to delete one-time prekey'));
        request.onsuccess = () => resolve();
    });
}

/**
 * Count unused one-time prekeys
 */
export async function countUnusedOneTimePreKeys(): Promise<number> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.ONE_TIME_PREKEYS], 'readonly');
        const store = transaction.objectStore(STORES.ONE_TIME_PREKEYS);
        const request = store.count();

        request.onerror = () => reject(new Error('Failed to count one-time prekeys'));
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * Get the highest key ID used
 */
export async function getHighestPreKeyId(): Promise<number> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.ONE_TIME_PREKEYS], 'readonly');
        const store = transaction.objectStore(STORES.ONE_TIME_PREKEYS);
        const request = store.openCursor(null, 'prev');

        request.onerror = () => reject(new Error('Failed to get highest prekey ID'));

        request.onsuccess = () => {
            const cursor = request.result;
            resolve(cursor ? cursor.key as number : 0);
        };
    });
}

// ============================================
// SESSION OPERATIONS
// ============================================

/**
 * Create a session key for storage
 */
function createSessionKey(peerUserId: number, roomId?: number): string {
    return roomId ? `${peerUserId}_${roomId}` : `${peerUserId}`;
}

/**
 * Store a session
 */
export async function storeSession(
    peerUserId: number,
    state: SessionState,
    roomId?: number
): Promise<void> {
    const database = await openDatabase();

    const serialized = JSON.stringify(state);
    const encrypted = await encryptForStorage(new TextEncoder().encode(serialized));

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.SESSIONS], 'readwrite');
        const store = transaction.objectStore(STORES.SESSIONS);

        const request = store.put({
            sessionKey: createSessionKey(peerUserId, roomId),
            peerUserId,
            roomId: roomId ?? null,
            data: encrypted,
            lastMessageAt: state.lastMessageAt,
            updatedAt: Date.now(),
        });

        request.onerror = () => reject(new Error('Failed to store session'));
        request.onsuccess = () => resolve();
    });
}

/**
 * Get a session
 */
export async function getSession(peerUserId: number, roomId?: number): Promise<SessionState | null> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.SESSIONS], 'readonly');
        const store = transaction.objectStore(STORES.SESSIONS);
        const request = store.get(createSessionKey(peerUserId, roomId));

        request.onerror = () => reject(new Error('Failed to get session'));

        request.onsuccess = async () => {
            if (!request.result) {
                resolve(null);
                return;
            }

            try {
                const decrypted = await decryptFromStorage(request.result.data);
                const parsed = JSON.parse(new TextDecoder().decode(decrypted));
                resolve(parsed);
            } catch (error) {
                console.error('Failed to decrypt session:', error);
                resolve(null);
            }
        };
    });
}

/**
 * Delete a session
 */
export async function deleteSession(peerUserId: number, roomId?: number): Promise<void> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.SESSIONS], 'readwrite');
        const store = transaction.objectStore(STORES.SESSIONS);
        const request = store.delete(createSessionKey(peerUserId, roomId));

        request.onerror = () => reject(new Error('Failed to delete session'));
        request.onsuccess = () => resolve();
    });
}

/**
 * Get all sessions
 */
export async function getAllSessions(): Promise<Array<{ peerUserId: number; roomId?: number; state: SessionState }>> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.SESSIONS], 'readonly');
        const store = transaction.objectStore(STORES.SESSIONS);
        const request = store.getAll();

        request.onerror = () => reject(new Error('Failed to get all sessions'));

        request.onsuccess = async () => {
            const results: Array<{ peerUserId: number; roomId?: number; state: SessionState }> = [];

            for (const item of request.result) {
                try {
                    const decrypted = await decryptFromStorage(item.data);
                    const parsed = JSON.parse(new TextDecoder().decode(decrypted));
                    results.push({
                        peerUserId: item.peerUserId,
                        roomId: item.roomId ?? undefined,
                        state: parsed,
                    });
                } catch (error) {
                    console.error('Failed to decrypt session:', error);
                }
            }

            resolve(results);
        };
    });
}

// ============================================
// METADATA OPERATIONS
// ============================================

/**
 * Store metadata
 */
export async function storeMetadata(key: string, value: any): Promise<void> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.METADATA], 'readwrite');
        const store = transaction.objectStore(STORES.METADATA);

        const request = store.put({
            key,
            value: JSON.stringify(value),
            updatedAt: Date.now(),
        });

        request.onerror = () => reject(new Error('Failed to store metadata'));
        request.onsuccess = () => resolve();
    });
}

/**
 * Get metadata
 */
export async function getMetadata<T>(key: string): Promise<T | null> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.METADATA], 'readonly');
        const store = transaction.objectStore(STORES.METADATA);
        const request = store.get(key);

        request.onerror = () => reject(new Error('Failed to get metadata'));

        request.onsuccess = () => {
            if (!request.result) {
                resolve(null);
                return;
            }
            resolve(JSON.parse(request.result.value));
        };
    });
}

// ============================================
// DATABASE MANAGEMENT
// ============================================

/**
 * Clear all E2E data (dangerous!)
 */
export async function clearAllData(): Promise<void> {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const storeNames = Object.values(STORES);
        const transaction = database.transaction(storeNames, 'readwrite');

        let completed = 0;
        for (const storeName of storeNames) {
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
            request.onsuccess = () => {
                completed++;
                if (completed === storeNames.length) {
                    deviceKey = null;
                    resolve();
                }
            };
        }
    });
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
    }
    deviceKey = null;
}

/**
 * Export all data (for backup)
 * Warning: This exports sensitive data!
 */
export async function exportAllData(): Promise<string> {
    const identity = await getIdentityKeyPair();
    const signedPreKey = await getCurrentSignedPreKey();
    const sessions = await getAllSessions();
    const registrationId = await getMetadata<number>('registrationId');

    const exportData = {
        identity: identity ? {
            publicKey: toBase64(identity.publicKey),
            privateKey: toBase64(identity.privateKey),
            signingPublicKey: toBase64(identity.signingPublicKey),
            signingPrivateKey: toBase64(identity.signingPrivateKey),
        } : null,
        signedPreKey: signedPreKey ? {
            keyId: signedPreKey.keyId,
            publicKey: toBase64(signedPreKey.publicKey),
            privateKey: toBase64(signedPreKey.privateKey),
            signature: toBase64(signedPreKey.signature),
            timestamp: signedPreKey.timestamp,
        } : null,
        sessions: sessions.map(s => ({
            peerUserId: s.peerUserId,
            roomId: s.roomId,
            state: s.state,
        })),
        registrationId,
        exportedAt: Date.now(),
    };

    return JSON.stringify(exportData);
}
