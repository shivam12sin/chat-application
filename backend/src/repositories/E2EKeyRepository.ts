import Database from '../config/database';

/**
 * Public Key Bundle structure returned by the server
 * Contains only PUBLIC keys - private keys never leave the client
 */
export interface PublicKeyBundle {
    userId: number;
    identityPublicKey: Buffer;
    signedPrekeyPublic: Buffer;
    signedPrekeyId: number;
    signedPrekeySignature: Buffer;
    registrationId: number;
    oneTimePrekey?: {
        keyId: number;
        publicKey: Buffer;
    };
}

/**
 * Device Key Bundle for multi-device support
 */
export interface DeviceKeyBundle {
    deviceId: string;
    deviceName?: string;
    identityPublicKey: Buffer;
    signedPrekeyPublic: Buffer;
    signedPrekeyId: number;
    signedPrekeySignature: Buffer;
    registrationId: number;
    isVerified: boolean;
    lastSeenAt?: Date;
}

/**
 * One-Time Prekey structure
 */
export interface OneTimePrekey {
    keyId: number;
    publicKey: Buffer;
}

/**
 * Session state (encrypted, opaque to server)
 */
export interface EncryptedSession {
    ownerUserId: number;
    peerUserId: number;
    roomId?: number;
    encryptedSessionState: Buffer;
    sessionVersion: number;
}

/**
 * Group Sender Key
 */
export interface GroupSenderKey {
    roomId: number;
    senderUserId: number;
    distributionKeyPublic: Buffer;
    distributionKeyId: number;
    chainIteration: number;
}

/**
 * E2E Key Repository
 * Handles all database operations for E2E encryption key management
 */
export class E2EKeyRepository {

    // ============================================
    // USER KEY BUNDLE OPERATIONS
    // ============================================

    /**
     * Register a user's public key bundle
     * Called when user first enables E2E encryption
     */
    static async registerKeyBundle(
        userId: number,
        identityPublicKey: Buffer,
        signedPrekeyPublic: Buffer,
        signedPrekeyId: number,
        signedPrekeySignature: Buffer,
        registrationId: number
    ): Promise<void> {
        await Database.query(`
            INSERT INTO user_keys (
                user_id, 
                identity_public_key, 
                signed_prekey_public, 
                signed_prekey_id,
                signed_prekey_signature,
                registration_id
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id) DO UPDATE SET
                identity_public_key = EXCLUDED.identity_public_key,
                signed_prekey_public = EXCLUDED.signed_prekey_public,
                signed_prekey_id = EXCLUDED.signed_prekey_id,
                signed_prekey_signature = EXCLUDED.signed_prekey_signature,
                registration_id = EXCLUDED.registration_id,
                updated_at = CURRENT_TIMESTAMP
        `, [userId, identityPublicKey, signedPrekeyPublic, signedPrekeyId, signedPrekeySignature, registrationId]);
    }

    /**
     * Get a user's public key bundle for encryption
     * Optionally consumes a one-time prekey
     */
    static async getKeyBundle(userId: number, consumeOneTimePrekey: boolean = true): Promise<PublicKeyBundle | null> {
        // Get main key bundle
        const result = await Database.query(`
            SELECT 
                user_id,
                identity_public_key,
                signed_prekey_public,
                signed_prekey_id,
                signed_prekey_signature,
                registration_id
            FROM user_keys
            WHERE user_id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        const bundle: PublicKeyBundle = {
            userId: row.user_id,
            identityPublicKey: row.identity_public_key,
            signedPrekeyPublic: row.signed_prekey_public,
            signedPrekeyId: row.signed_prekey_id,
            signedPrekeySignature: row.signed_prekey_signature,
            registrationId: row.registration_id,
        };

        // Optionally get and consume a one-time prekey
        if (consumeOneTimePrekey) {
            const oneTimePrekey = await this.consumeOneTimePrekey(userId);
            if (oneTimePrekey) {
                bundle.oneTimePrekey = oneTimePrekey;
            }
        }

        return bundle;
    }

    /**
     * Check if user has E2E encryption enabled (has registered keys)
     */
    static async hasRegisteredKeys(userId: number): Promise<boolean> {
        const result = await Database.query(
            'SELECT 1 FROM user_keys WHERE user_id = $1 LIMIT 1',
            [userId]
        );
        return result.rows.length > 0;
    }

    /**
     * Update signed prekey (should be rotated every 7-30 days)
     */
    static async updateSignedPrekey(
        userId: number,
        signedPrekeyPublic: Buffer,
        signedPrekeyId: number,
        signedPrekeySignature: Buffer
    ): Promise<void> {
        // Get old key ID for rotation history
        const oldKeyResult = await Database.query(
            'SELECT signed_prekey_id FROM user_keys WHERE user_id = $1',
            [userId]
        );
        const oldKeyId = oldKeyResult.rows[0]?.signed_prekey_id;

        // Update the key
        await Database.query(`
            UPDATE user_keys SET
                signed_prekey_public = $2,
                signed_prekey_id = $3,
                signed_prekey_signature = $4,
                signed_prekey_updated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
        `, [userId, signedPrekeyPublic, signedPrekeyId, signedPrekeySignature]);

        // Log rotation
        if (oldKeyId !== undefined) {
            await Database.query(`
                INSERT INTO key_rotation_history (user_id, key_type, old_key_id, new_key_id, rotation_reason)
                VALUES ($1, 'signed_prekey', $2, $3, 'scheduled')
            `, [userId, oldKeyId, signedPrekeyId]);
        }
    }

    // ============================================
    // ONE-TIME PREKEY OPERATIONS
    // ============================================

    /**
     * Upload a batch of one-time prekeys
     * Client should maintain ~100 prekeys on server
     */
    static async uploadOneTimePrekeys(
        userId: number,
        prekeys: Array<{ keyId: number; publicKey: Buffer }>
    ): Promise<number> {
        if (prekeys.length === 0) return 0;

        const values: any[] = [];
        const placeholders: string[] = [];

        prekeys.forEach((prekey, index) => {
            const offset = index * 3;
            placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
            values.push(userId, prekey.keyId, prekey.publicKey);
        });

        await Database.query(`
            INSERT INTO one_time_prekeys (user_id, key_id, public_key)
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (user_id, key_id) DO NOTHING
        `, values);

        return prekeys.length;
    }

    /**
     * Get and consume a one-time prekey
     * Returns null if no prekeys available
     */
    static async consumeOneTimePrekey(userId: number, consumedByUserId?: number): Promise<OneTimePrekey | null> {
        // Use SELECT FOR UPDATE to prevent race conditions
        const result = await Database.query(`
            UPDATE one_time_prekeys
            SET used = TRUE, used_at = CURRENT_TIMESTAMP, used_by_user_id = $2
            WHERE id = (
                SELECT id FROM one_time_prekeys
                WHERE user_id = $1 AND used = FALSE
                ORDER BY key_id ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING key_id, public_key
        `, [userId, consumedByUserId]);

        if (result.rows.length === 0) {
            return null;
        }

        return {
            keyId: result.rows[0].key_id,
            publicKey: result.rows[0].public_key,
        };
    }

    /**
     * Get count of available one-time prekeys
     * Client should refill when count drops below threshold (e.g., 25)
     */
    static async getAvailablePrekeyCount(userId: number): Promise<number> {
        const result = await Database.query(
            'SELECT COUNT(*) as count FROM one_time_prekeys WHERE user_id = $1 AND used = FALSE',
            [userId]
        );
        return parseInt(result.rows[0].count, 10);
    }

    /**
     * Clean up old used prekeys (maintenance task)
     */
    static async cleanupUsedPrekeys(olderThanDays: number = 30): Promise<number> {
        const result = await Database.query(`
            DELETE FROM one_time_prekeys
            WHERE used = TRUE AND used_at < NOW() - INTERVAL '${olderThanDays} days'
        `);
        return result.rowCount || 0;
    }

    // ============================================
    // SESSION OPERATIONS
    // ============================================

    /**
     * Store encrypted session state
     * Session state is encrypted client-side, server cannot read it
     */
    static async storeSession(
        ownerUserId: number,
        peerUserId: number,
        encryptedSessionState: Buffer,
        roomId?: number
    ): Promise<void> {
        await Database.query(`
            INSERT INTO e2e_sessions (
                owner_user_id, peer_user_id, room_id, encrypted_session_state
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (owner_user_id, peer_user_id, room_id) DO UPDATE SET
                encrypted_session_state = EXCLUDED.encrypted_session_state,
                session_version = e2e_sessions.session_version + 1,
                updated_at = CURRENT_TIMESTAMP
        `, [ownerUserId, peerUserId, roomId || null, encryptedSessionState]);
    }

    /**
     * Get encrypted session state
     */
    static async getSession(
        ownerUserId: number,
        peerUserId: number,
        roomId?: number
    ): Promise<EncryptedSession | null> {
        const result = await Database.query(`
            SELECT 
                owner_user_id,
                peer_user_id,
                room_id,
                encrypted_session_state,
                session_version
            FROM e2e_sessions
            WHERE owner_user_id = $1 AND peer_user_id = $2 
                AND (room_id = $3 OR (room_id IS NULL AND $3 IS NULL))
        `, [ownerUserId, peerUserId, roomId || null]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            ownerUserId: row.owner_user_id,
            peerUserId: row.peer_user_id,
            roomId: row.room_id,
            encryptedSessionState: row.encrypted_session_state,
            sessionVersion: row.session_version,
        };
    }

    /**
     * Get all sessions for a user (for sync/backup)
     */
    static async getAllSessions(ownerUserId: number): Promise<EncryptedSession[]> {
        const result = await Database.query(`
            SELECT 
                owner_user_id,
                peer_user_id,
                room_id,
                encrypted_session_state,
                session_version
            FROM e2e_sessions
            WHERE owner_user_id = $1
            ORDER BY updated_at DESC
        `, [ownerUserId]);

        return result.rows.map(row => ({
            ownerUserId: row.owner_user_id,
            peerUserId: row.peer_user_id,
            roomId: row.room_id,
            encryptedSessionState: row.encrypted_session_state,
            sessionVersion: row.session_version,
        }));
    }

    /**
     * Delete a session
     */
    static async deleteSession(
        ownerUserId: number,
        peerUserId: number,
        roomId?: number
    ): Promise<void> {
        await Database.query(`
            DELETE FROM e2e_sessions
            WHERE owner_user_id = $1 AND peer_user_id = $2
                AND (room_id = $3 OR (room_id IS NULL AND $3 IS NULL))
        `, [ownerUserId, peerUserId, roomId || null]);
    }

    // ============================================
    // DEVICE KEY OPERATIONS (Multi-device)
    // ============================================

    /**
     * Register a new device
     */
    static async registerDevice(
        userId: number,
        deviceId: string,
        deviceName: string | undefined,
        identityPublicKey: Buffer,
        signedPrekeyPublic: Buffer,
        signedPrekeyId: number,
        signedPrekeySignature: Buffer,
        registrationId: number
    ): Promise<void> {
        await Database.query(`
            INSERT INTO device_keys (
                user_id, device_id, device_name,
                device_identity_public_key,
                device_signed_prekey_public,
                device_signed_prekey_id,
                device_signed_prekey_signature,
                device_registration_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id, device_id) DO UPDATE SET
                device_name = EXCLUDED.device_name,
                device_signed_prekey_public = EXCLUDED.device_signed_prekey_public,
                device_signed_prekey_id = EXCLUDED.device_signed_prekey_id,
                device_signed_prekey_signature = EXCLUDED.device_signed_prekey_signature,
                last_seen_at = CURRENT_TIMESTAMP
        `, [userId, deviceId, deviceName, identityPublicKey, signedPrekeyPublic, signedPrekeyId, signedPrekeySignature, registrationId]);
    }

    /**
     * Get all devices for a user
     */
    static async getUserDevices(userId: number): Promise<DeviceKeyBundle[]> {
        const result = await Database.query(`
            SELECT 
                device_id,
                device_name,
                device_identity_public_key,
                device_signed_prekey_public,
                device_signed_prekey_id,
                device_signed_prekey_signature,
                device_registration_id,
                is_verified,
                last_seen_at
            FROM device_keys
            WHERE user_id = $1
            ORDER BY last_seen_at DESC
        `, [userId]);

        return result.rows.map(row => ({
            deviceId: row.device_id,
            deviceName: row.device_name,
            identityPublicKey: row.device_identity_public_key,
            signedPrekeyPublic: row.device_signed_prekey_public,
            signedPrekeyId: row.device_signed_prekey_id,
            signedPrekeySignature: row.device_signed_prekey_signature,
            registrationId: row.device_registration_id,
            isVerified: row.is_verified,
            lastSeenAt: row.last_seen_at,
        }));
    }

    /**
     * Verify a device (from another trusted device)
     */
    static async verifyDevice(
        userId: number,
        deviceId: string,
        verifiedByDeviceId: string
    ): Promise<void> {
        await Database.query(`
            UPDATE device_keys SET
                is_verified = TRUE,
                verified_at = CURRENT_TIMESTAMP,
                verified_by_device_id = $3
            WHERE user_id = $1 AND device_id = $2
        `, [userId, deviceId, verifiedByDeviceId]);
    }

    /**
     * Remove a device
     */
    static async removeDevice(userId: number, deviceId: string): Promise<void> {
        await Database.query(
            'DELETE FROM device_keys WHERE user_id = $1 AND device_id = $2',
            [userId, deviceId]
        );
    }

    // ============================================
    // GROUP SENDER KEY OPERATIONS
    // ============================================

    /**
     * Store/update a sender key for group encryption
     */
    static async storeSenderKey(
        roomId: number,
        senderUserId: number,
        distributionKeyPublic: Buffer,
        distributionKeyId: number
    ): Promise<void> {
        await Database.query(`
            INSERT INTO group_sender_keys (
                room_id, sender_user_id, distribution_key_public, distribution_key_id
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (room_id, sender_user_id) DO UPDATE SET
                distribution_key_public = EXCLUDED.distribution_key_public,
                distribution_key_id = EXCLUDED.distribution_key_id,
                chain_iteration = 0,
                updated_at = CURRENT_TIMESTAMP
        `, [roomId, senderUserId, distributionKeyPublic, distributionKeyId]);

        // Log rotation
        await Database.query(`
            INSERT INTO key_rotation_history (user_id, key_type, new_key_id, rotation_reason)
            VALUES ($1, 'sender_key', $2, 'member_change')
        `, [senderUserId, distributionKeyId]);
    }

    /**
     * Get all sender keys for a room
     */
    static async getRoomSenderKeys(roomId: number): Promise<GroupSenderKey[]> {
        const result = await Database.query(`
            SELECT 
                room_id,
                sender_user_id,
                distribution_key_public,
                distribution_key_id,
                chain_iteration
            FROM group_sender_keys
            WHERE room_id = $1
        `, [roomId]);

        return result.rows.map(row => ({
            roomId: row.room_id,
            senderUserId: row.sender_user_id,
            distributionKeyPublic: row.distribution_key_public,
            distributionKeyId: row.distribution_key_id,
            chainIteration: row.chain_iteration,
        }));
    }

    /**
     * Get a specific sender's key for a room
     */
    static async getSenderKey(roomId: number, senderUserId: number): Promise<GroupSenderKey | null> {
        const result = await Database.query(`
            SELECT 
                room_id,
                sender_user_id,
                distribution_key_public,
                distribution_key_id,
                chain_iteration
            FROM group_sender_keys
            WHERE room_id = $1 AND sender_user_id = $2
        `, [roomId, senderUserId]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            roomId: row.room_id,
            senderUserId: row.sender_user_id,
            distributionKeyPublic: row.distribution_key_public,
            distributionKeyId: row.distribution_key_id,
            chainIteration: row.chain_iteration,
        };
    }

    /**
     * Increment chain iteration (for message ordering)
     */
    static async incrementChainIteration(roomId: number, senderUserId: number): Promise<number> {
        const result = await Database.query(`
            UPDATE group_sender_keys
            SET chain_iteration = chain_iteration + 1, updated_at = CURRENT_TIMESTAMP
            WHERE room_id = $1 AND sender_user_id = $2
            RETURNING chain_iteration
        `, [roomId, senderUserId]);

        return result.rows[0]?.chain_iteration || 0;
    }

    /**
     * Delete sender keys for a room (when room is deleted)
     */
    static async deleteRoomSenderKeys(roomId: number): Promise<void> {
        await Database.query(
            'DELETE FROM group_sender_keys WHERE room_id = $1',
            [roomId]
        );
    }

    /**
     * Delete a user's sender key from a room (when they leave)
     */
    static async deleteSenderKey(roomId: number, senderUserId: number): Promise<void> {
        await Database.query(
            'DELETE FROM group_sender_keys WHERE room_id = $1 AND sender_user_id = $2',
            [roomId, senderUserId]
        );
    }

    /**
     * Store (Upsert) user key backup
     */
    static async saveBackup(userId: number, backupData: string): Promise<void> {
        await Database.query(
            `INSERT INTO user_key_backups (user_id, backup_data, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id) 
             DO UPDATE SET backup_data = $2, updated_at = NOW(), version = user_key_backups.version + 1`,
            [userId, backupData]
        );
    }

    /**
     * Get user key backup
     */
    static async getBackup(userId: number): Promise<{ backupData: string, version: number, updatedAt: Date } | null> {
        const result = await Database.query(
            'SELECT backup_data, version, updated_at FROM user_key_backups WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) return null;

        return {
            backupData: result.rows[0].backup_data,
            version: result.rows[0].version,
            updatedAt: result.rows[0].updated_at
        };
    }
}

export default E2EKeyRepository;
