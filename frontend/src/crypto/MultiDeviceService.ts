/**
 * Multi-Device E2E Service
 * 
 * Manages device registration, linking, and key synchronization for multi-device E2E encryption.
 * 
 * Key concepts:
 * - Each device has its own identity key pair
 * - Devices are linked to a user account
 * - Sessions are established per-device, not per-user
 * - Messages are encrypted for ALL recipient's devices
 */

import { e2eCryptoService } from './E2ECryptoService';
import {
    generateIdentityKeyPair,
    generateSignedPreKey,
    generateOneTimePreKeys,
} from './x3dh';
import {
    toBase64,
    fromBase64,
    generateRegistrationId,
    generateKeyId,
} from './utils';
import axios from 'axios';

// ============================================
// TYPES
// ============================================

export interface DeviceInfo {
    deviceId: string;
    deviceName: string;
    platform: 'web' | 'ios' | 'android' | 'desktop';
    lastSeen: Date;
    isCurrentDevice: boolean;
    isVerified: boolean;
    identityKeyFingerprint: string;
    registrationId: number;
}

export interface DeviceKeyBundle {
    deviceId: string;
    identityPublicKey: Uint8Array;
    signedPrekeyPublic: Uint8Array;
    signedPrekeyId: number;
    signedPrekeySignature: Uint8Array;
    registrationId: number;
    oneTimePrekey?: {
        keyId: number;
        publicKey: Uint8Array;
    };
}

export interface DeviceRegistrationData {
    deviceId: string;
    deviceName: string;
    platform: 'web' | 'ios' | 'android' | 'desktop';
    identityPublicKey: string;  // Base64
    signedPrekeyPublic: string; // Base64
    signedPrekeyId: number;
    signedPrekeySignature: string; // Base64
    registrationId: number;
    oneTimePrekeys: Array<{ keyId: number; publicKey: string }>;
}

export interface DeviceLinkRequest {
    linkingCode: string;
    newDeviceId: string;
    newDeviceName: string;
    newDevicePublicKey: string;
}

export interface DeviceLinkApproval {
    requestId: string;
    newDeviceId: string;
    newDeviceName: string;
    newDeviceFingerprint: string;
    approved: boolean;
}

export interface KeyBackup {
    version: number;
    encryptedIdentityKey: string;  // Encrypted with user password
    encryptedSignedPrekey: string;
    registrationId: number;
    salt: string;
    iv: string;
    timestamp: string;
}

export interface MultiDeviceConfig {
    apiUrl: string;
    token: string;
    userId: number;
}

// ============================================
// STORAGE KEYS
// ============================================

const DEVICE_ID_KEY = 'e2e_device_id';
const DEVICE_NAME_KEY = 'e2e_device_name';
const DEVICE_REGISTRATION_KEY = 'e2e_device_registration';
const KEY_BACKUP_KEY = 'e2e_key_backup';

// ============================================
// MULTI-DEVICE SERVICE CLASS
// ============================================

class MultiDeviceService {
    private config: MultiDeviceConfig | null = null;
    private deviceId: string | null = null;
    private deviceName: string | null = null;

    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Initialize the multi-device service
     */
    async initialize(config: MultiDeviceConfig): Promise<void> {
        this.config = config;

        // Load device ID from storage
        this.deviceId = localStorage.getItem(DEVICE_ID_KEY);
        this.deviceName = localStorage.getItem(DEVICE_NAME_KEY);

        // If no device ID, this is a new device
        if (!this.deviceId) {
            this.deviceId = this.generateDeviceId();
            localStorage.setItem(DEVICE_ID_KEY, this.deviceId);
        }

        // Set default device name if not set
        if (!this.deviceName) {
            this.deviceName = this.generateDefaultDeviceName();
            localStorage.setItem(DEVICE_NAME_KEY, this.deviceName);
        }
    }

    /**
     * Generate a unique device ID
     */
    private generateDeviceId(): string {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate a default device name based on browser/platform
     */
    private generateDefaultDeviceName(): string {
        const userAgent = navigator.userAgent;
        let platform = 'Unknown';
        let browser = 'Browser';

        if (userAgent.includes('Mac')) platform = 'Mac';
        else if (userAgent.includes('Windows')) platform = 'Windows';
        else if (userAgent.includes('Linux')) platform = 'Linux';
        else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) platform = 'iOS';
        else if (userAgent.includes('Android')) platform = 'Android';

        if (userAgent.includes('Chrome')) browser = 'Chrome';
        else if (userAgent.includes('Firefox')) browser = 'Firefox';
        else if (userAgent.includes('Safari')) browser = 'Safari';
        else if (userAgent.includes('Edge')) browser = 'Edge';

        return `${platform} ${browser}`;
    }

    /**
     * Get current platform type
     */
    private getPlatform(): 'web' | 'ios' | 'android' | 'desktop' {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'ios';
        if (userAgent.includes('Android')) return 'android';
        if (userAgent.includes('Electron')) return 'desktop';
        return 'web';
    }

    // ============================================
    // DEVICE REGISTRATION
    // ============================================

    /**
     * Register this device with E2E encryption
     */
    async registerDevice(): Promise<DeviceRegistrationData> {
        if (!this.config || !this.deviceId) {
            throw new Error('Service not initialized');
        }

        // Generate key bundle for this device
        const identityKeyPair = await generateIdentityKeyPair();
        const registrationId = generateRegistrationId();
        const signedPreKey = await generateSignedPreKey(identityKeyPair.signingPrivateKey, generateKeyId());
        const startKeyId = generateKeyId();
        const oneTimePreKeys = await generateOneTimePreKeys(startKeyId, 100);

        // Store keys locally (through e2eCryptoService)
        // The actual storage is handled by the main E2E service

        const registrationData: DeviceRegistrationData = {
            deviceId: this.deviceId,
            deviceName: this.deviceName || this.generateDefaultDeviceName(),
            platform: this.getPlatform(),
            identityPublicKey: toBase64(identityKeyPair.publicKey),
            signedPrekeyPublic: toBase64(signedPreKey.publicKey),
            signedPrekeyId: signedPreKey.keyId,
            signedPrekeySignature: toBase64(signedPreKey.signature),
            registrationId,
            oneTimePrekeys: oneTimePreKeys.map(pk => ({
                keyId: pk.keyId,
                publicKey: toBase64(pk.publicKey),
            })),
        };

        // Register with server
        await axios.post(
            `${this.config.apiUrl}/e2e/devices`,
            registrationData,
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );

        // Store registration info
        localStorage.setItem(DEVICE_REGISTRATION_KEY, JSON.stringify({
            deviceId: this.deviceId,
            registrationId,
            timestamp: new Date().toISOString(),
        }));

        return registrationData;
    }

    /**
     * Get platform from device name
     */
    private getPlatformFromName(name: string): 'web' | 'ios' | 'android' | 'desktop' {
        const lower = (name || '').toLowerCase();
        if (lower.includes('iphone') || lower.includes('ipad')) return 'ios';
        if (lower.includes('android')) return 'android';
        // Only classify as desktop if explicitly Electron or Desktop app
        if (lower.includes('electron') || lower.includes('desktop_app')) return 'desktop';
        return 'web';
    }

    /**
     * Get all registered devices for the current user
     */
    async getDevices(): Promise<DeviceInfo[]> {
        if (!this.config) throw new Error('Service not initialized');

        const response = await axios.get(
            `${this.config.apiUrl}/e2e/devices/${this.config.userId}`,
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );

        // Backend returns cameCase
        const devices = response.data.devices as Array<{
            deviceId: string;
            deviceName: string;
            lastSeen: string;
            isVerified: boolean;
            identityPublicKey: string;
            registrationId: number;
        }>;

        return devices.map(d => ({
            deviceId: d.deviceId,
            deviceName: d.deviceName || 'Unknown Device',
            platform: this.getPlatformFromName(d.deviceName),
            lastSeen: d.lastSeen ? new Date(d.lastSeen) : new Date(), // Fallback to now if missing
            isCurrentDevice: d.deviceId.replace(/-/g, '').toLowerCase() === (this.deviceId || '').replace(/-/g, '').toLowerCase(),
            isVerified: d.isVerified,
            // Create a pseudo-fingerprint from the public key (using first 16 chars)
            identityKeyFingerprint: d.identityPublicKey ?
                d.identityPublicKey.substring(0, 16).match(/.{1,4}/g)?.join(' ') || d.identityPublicKey.substring(0, 16)
                : 'Unknown',
            registrationId: d.registrationId,
        }));
    }

    /**
     * Remove a device from the user's account
     */
    async removeDevice(deviceId: string): Promise<void> {
        if (!this.config) throw new Error('Service not initialized');

        await axios.delete(
            `${this.config.apiUrl}/e2e/devices/${deviceId}`,
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );

        // If removing current device, clear local data
        if (deviceId === this.deviceId) {
            localStorage.removeItem(DEVICE_ID_KEY);
            localStorage.removeItem(DEVICE_NAME_KEY);
            localStorage.removeItem(DEVICE_REGISTRATION_KEY);
        }
    }

    /**
     * Update device name
     */
    async updateDeviceName(newName: string): Promise<void> {
        if (!this.config || !this.deviceId) throw new Error('Service not initialized');

        await axios.put(
            `${this.config.apiUrl}/e2e/devices/${this.deviceId}`,
            { deviceName: newName },
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );

        this.deviceName = newName;
        localStorage.setItem(DEVICE_NAME_KEY, newName);
    }

    // ============================================
    // DEVICE LINKING
    // ============================================

    /**
     * Generate a linking code for adding a new device
     * This code should be displayed on the existing device
     */
    async generateLinkingCode(): Promise<{ code: string; expiresAt: Date }> {
        if (!this.config) throw new Error('Service not initialized');

        const response = await axios.post(
            `${this.config.apiUrl}/e2e/devices/linking-code`,
            {},
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );

        return {
            code: response.data.code,
            expiresAt: new Date(response.data.expiresAt),
        };
    }

    /**
     * Link a new device using a linking code
     * Called from the new device
     */
    async linkWithCode(linkingCode: string): Promise<boolean> {
        if (!this.config || !this.deviceId) throw new Error('Service not initialized');

        // Generate keys for the new device
        const identityKeyPair = await generateIdentityKeyPair();

        const linkRequest: DeviceLinkRequest = {
            linkingCode,
            newDeviceId: this.deviceId,
            newDeviceName: this.deviceName || this.generateDefaultDeviceName(),
            newDevicePublicKey: toBase64(identityKeyPair.publicKey),
        };

        const response = await axios.post(
            `${this.config.apiUrl}/e2e/devices/link`,
            linkRequest,
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );

        if (response.data.success) {
            // Poll for approval
            const requestId = response.data.requestId;
            let attempts = 0;
            const maxAttempts = 150; // 5 minutes (2s interval)

            while (attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 2000));

                try {
                    const statusRes = await axios.get(
                        `${this.config.apiUrl}/e2e/devices/link-requests/${requestId}/status`,
                        {
                            headers: { Authorization: `Bearer ${this.config.token}` },
                        }
                    );

                    if (statusRes.data.status === 'approved') {
                        // Complete device registration
                        await this.registerDevice();
                        return true;
                    } else if (statusRes.data.status === 'rejected') {
                        return false;
                    }
                } catch (e) {
                    // Ignore transient errors during polling
                }
                attempts++;
            }
        }

        return false;
    }

    /**
     * Get pending device link requests (for approval on existing device)
     */
    async getPendingLinkRequests(): Promise<DeviceLinkApproval[]> {
        if (!this.config) throw new Error('Service not initialized');

        const response = await axios.get(
            `${this.config.apiUrl}/e2e/devices/link-requests`,
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );

        return response.data.requests;
    }

    /**
     * Approve or reject a device link request
     */
    async respondToLinkRequest(
        requestId: string,
        approved: boolean
    ): Promise<void> {
        if (!this.config) throw new Error('Service not initialized');

        await axios.post(
            `${this.config.apiUrl}/e2e/devices/link-requests/${requestId}/respond`,
            { approved },
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );
    }

    // ============================================
    // DEVICE VERIFICATION
    // ============================================

    /**
     * Verify another device (from this device)
     */
    async verifyDevice(targetDeviceId: string): Promise<void> {
        if (!this.config || !this.deviceId) throw new Error('Service not initialized');

        await axios.post(
            `${this.config.apiUrl}/e2e/devices/${targetDeviceId}/verify`,
            { verifyingDeviceId: this.deviceId },
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );
    }

    /**
     * Get verification QR code data for this device
     */
    async getVerificationQRData(): Promise<string> {
        if (!this.config || !this.deviceId) throw new Error('Service not initialized');

        // Get this device's fingerprint
        const ownFingerprint = await e2eCryptoService.getOwnFingerprint();

        // Create QR code data
        const qrData = JSON.stringify({
            userId: this.config.userId,
            deviceId: this.deviceId,
            fingerprint: ownFingerprint,
            timestamp: Date.now(),
        });

        return btoa(qrData);
    }

    /**
     * Verify a device by scanning its QR code
     */
    async verifyDeviceByQR(qrData: string): Promise<{
        success: boolean;
        deviceId?: string;
        error?: string;
    }> {
        try {
            const data = JSON.parse(atob(qrData));

            // Verify the QR code is for the same user
            if (data.userId !== this.config?.userId) {
                return { success: false, error: 'QR code is for a different user' };
            }

            // Verify the fingerprint matches
            const devices = await this.getDevices();
            const targetDevice = devices.find(d => d.deviceId === data.deviceId);

            if (!targetDevice) {
                return { success: false, error: 'Device not found' };
            }

            if (targetDevice.identityKeyFingerprint !== data.fingerprint) {
                return { success: false, error: 'Fingerprint mismatch - possible security issue!' };
            }

            // Mark as verified
            await this.verifyDevice(data.deviceId);

            return { success: true, deviceId: data.deviceId };
        } catch (error) {
            return { success: false, error: 'Invalid QR code' };
        }
    }

    // ============================================
    // KEY BACKUP & RESTORE
    // ============================================

    /**
     * Create an encrypted backup of the identity keys and upload to server
     * The backup is encrypted with a user-provided password
     */
    async createKeyBackup(password: string): Promise<KeyBackup> {
        if (!this.config) throw new Error('Service not initialized');

        // Get the identity key from the E2E service
        const identityKey = await e2eCryptoService.getOwnFingerprint();
        if (!identityKey) {
            throw new Error('No identity key to backup');
        }

        // Derive encryption key from password
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const passwordKey = await this.deriveKeyFromPassword(password, salt);

        // Get the raw key data (this would need to be exposed from keyStore)
        // For now, we'll backup the registration data
        const registrationData = localStorage.getItem(DEVICE_REGISTRATION_KEY);
        if (!registrationData) {
            throw new Error('No registration data to backup');
        }

        // Encrypt the data
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            passwordKey,
            new TextEncoder().encode(registrationData)
        );

        const backup: KeyBackup = {
            version: 1,
            encryptedIdentityKey: toBase64(new Uint8Array(encryptedData)),
            encryptedSignedPrekey: '', // Would include signed prekey
            registrationId: JSON.parse(registrationData).registrationId,
            salt: toBase64(salt),
            iv: toBase64(iv),
            timestamp: new Date().toISOString(),
        };

        // Store backup locally
        localStorage.setItem(KEY_BACKUP_KEY, JSON.stringify(backup));

        // Upload to server
        await axios.post(
            `${this.config.apiUrl}/e2e/backup`,
            { backupData: JSON.stringify(backup) },
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );

        return backup;
    }

    /**
     * Check if a cloud backup exists
     */
    async checkCloudBackup(): Promise<boolean> {
        if (!this.config) return false;
        try {
            await axios.get(
                `${this.config.apiUrl}/e2e/backup`,
                {
                    headers: { Authorization: `Bearer ${this.config.token}` },
                }
            );
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Fetch cloud backup
     */
    async fetchCloudBackup(): Promise<KeyBackup | null> {
        if (!this.config) return null;
        try {
            const response = await axios.get(
                `${this.config.apiUrl}/e2e/backup`,
                {
                    headers: { Authorization: `Bearer ${this.config.token}` },
                }
            );
            return JSON.parse(response.data.backupData);
        } catch (error) {
            return null;
        }
    }

    /**
     * Restore keys from an encrypted backup (local or cloud)
     */
    async restoreKeyBackup(password: string, backupData?: KeyBackup): Promise<boolean> {
        try {
            let backup = backupData;

            // If no backup provided, try to fetch from cloud
            if (!backup) {
                backup = await this.fetchCloudBackup() || undefined;
            }

            if (!backup) {
                throw new Error('No backup found');
            }

            // Derive decryption key from password
            const salt = fromBase64(backup.salt);
            const passwordKey = await this.deriveKeyFromPassword(password, salt);

            // Decrypt the data
            const iv = fromBase64(backup.iv);
            const encryptedData = fromBase64(backup.encryptedIdentityKey);

            const decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(iv) },
                passwordKey,
                new Uint8Array(encryptedData)
            );

            const registrationData = new TextDecoder().decode(decryptedData);

            // Restore the data
            localStorage.setItem(DEVICE_REGISTRATION_KEY, registrationData);

            return true;
        } catch (error) {
            console.error('Failed to restore key backup:', error);
            return false;
        }
    }

    /**
     * Derive an encryption key from a password using PBKDF2
     */
    private async deriveKeyFromPassword(
        password: string,
        salt: Uint8Array
    ): Promise<CryptoKey> {
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: new Uint8Array(salt),
                iterations: 100000,
                hash: 'SHA-256',
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    // ============================================
    // MULTI-DEVICE MESSAGING
    // ============================================

    /**
     * Get all device key bundles for a user (for encrypting to all their devices)
     */
    async getUserDeviceKeyBundles(userId: number): Promise<DeviceKeyBundle[]> {
        if (!this.config) throw new Error('Service not initialized');

        const response = await axios.get(
            `${this.config.apiUrl}/e2e/keys/user/${userId}/devices`,
            {
                headers: { Authorization: `Bearer ${this.config.token}` },
            }
        );

        return response.data.devices.map((d: any) => ({
            deviceId: d.device_id,
            identityPublicKey: fromBase64(d.identity_public_key),
            signedPrekeyPublic: fromBase64(d.signed_prekey_public),
            signedPrekeyId: d.signed_prekey_id,
            signedPrekeySignature: fromBase64(d.signed_prekey_signature),
            registrationId: d.registration_id,
            oneTimePrekey: d.one_time_prekey ? {
                keyId: d.one_time_prekey.key_id,
                publicKey: fromBase64(d.one_time_prekey.public_key),
            } : undefined,
        }));
    }

    // ============================================
    // GETTERS
    // ============================================

    /**
     * Get current device ID
     */
    getDeviceId(): string | null {
        return this.deviceId;
    }

    /**
     * Get current device name
     */
    getDeviceName(): string | null {
        return this.deviceName;
    }

    /**
     * Check if device is registered
     */
    isDeviceRegistered(): boolean {
        return localStorage.getItem(DEVICE_REGISTRATION_KEY) !== null;
    }
}

// Export singleton instance
export const multiDeviceService = new MultiDeviceService();
export default MultiDeviceService;
