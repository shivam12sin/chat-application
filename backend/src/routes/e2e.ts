import { Router, Response, Request } from 'express';
import { authenticateTokenHTTP } from '../middleware/auth';
import { E2EKeyRepository } from '../repositories/E2EKeyRepository';

const router = Router();

// Extended Request type with user info
interface AuthenticatedRequest extends Request {
    user?: {
        userId: number;
        username: string;
    };
}

/**
 * E2E Encryption Key Management API
 * 
 * These endpoints handle public key distribution for end-to-end encryption.
 * IMPORTANT: Only PUBLIC keys are stored/transmitted. Private keys NEVER leave the client.
 */

// ============================================
// KEY BUNDLE REGISTRATION
// ============================================

/**
 * POST /api/e2e/keys/register
 * Register user's initial key bundle
 * 
 * Body: {
 *   identityPublicKey: string (base64),
 *   signedPrekeyPublic: string (base64),
 *   signedPrekeyId: number,
 *   signedPrekeySignature: string (base64),
 *   registrationId: number,
 *   oneTimePrekeys: Array<{ keyId: number, publicKey: string (base64) }>
 * }
 */
router.post('/keys/register', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const {
            identityPublicKey,
            signedPrekeyPublic,
            signedPrekeyId,
            signedPrekeySignature,
            registrationId,
            oneTimePrekeys = []
        } = req.body;

        // Validate required fields
        if (!identityPublicKey || !signedPrekeyPublic || !signedPrekeySignature) {
            return res.status(400).json({
                error: 'Missing required key fields',
                required: ['identityPublicKey', 'signedPrekeyPublic', 'signedPrekeyId', 'signedPrekeySignature', 'registrationId']
            });
        }

        // Convert base64 to buffers
        const identityBuffer = Buffer.from(identityPublicKey, 'base64');
        const signedPrekeyBuffer = Buffer.from(signedPrekeyPublic, 'base64');
        const signatureBuffer = Buffer.from(signedPrekeySignature, 'base64');

        // Validate key sizes (X25519 = 32 bytes, Ed25519 signature = 64 bytes)
        if (identityBuffer.length !== 32) {
            return res.status(400).json({ error: 'Invalid identity key size (expected 32 bytes)' });
        }
        if (signedPrekeyBuffer.length !== 32) {
            return res.status(400).json({ error: 'Invalid signed prekey size (expected 32 bytes)' });
        }
        if (signatureBuffer.length !== 64) {
            return res.status(400).json({ error: 'Invalid signature size (expected 64 bytes)' });
        }

        // Register the key bundle
        await E2EKeyRepository.registerKeyBundle(
            userId,
            identityBuffer,
            signedPrekeyBuffer,
            signedPrekeyId,
            signatureBuffer,
            registrationId
        );

        // Upload one-time prekeys if provided
        let uploadedPrekeys = 0;
        if (oneTimePrekeys.length > 0) {
            const prekeysToUpload = oneTimePrekeys.map((pk: { keyId: number; publicKey: string }) => ({
                keyId: pk.keyId,
                publicKey: Buffer.from(pk.publicKey, 'base64')
            }));
            uploadedPrekeys = await E2EKeyRepository.uploadOneTimePrekeys(userId, prekeysToUpload);
        }

        return res.status(201).json({
            success: true,
            message: 'Key bundle registered successfully',
            uploadedPrekeys
        });

    } catch (error) {
        console.error('Key registration error:', error);
        return res.status(500).json({ error: 'Failed to register key bundle' });
    }
});

/**
 * GET /api/e2e/keys/:userId
 * Get a user's public key bundle for encryption
 * 
 * Query params:
 *   - consumePrekey: boolean (default: true) - whether to consume a one-time prekey
 */
router.get('/keys/:userId', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const targetUserId = parseInt(req.params.userId, 10);
        const consumePrekey = req.query.consumePrekey !== 'false';

        if (isNaN(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const bundle = await E2EKeyRepository.getKeyBundle(targetUserId, consumePrekey);

        if (!bundle) {
            return res.status(404).json({
                error: 'User has not registered E2E encryption keys',
                e2eEnabled: false
            });
        }

        // Convert buffers to base64 for JSON transport
        return res.json({
            userId: bundle.userId,
            identityPublicKey: bundle.identityPublicKey.toString('base64'),
            signedPrekeyPublic: bundle.signedPrekeyPublic.toString('base64'),
            signedPrekeyId: bundle.signedPrekeyId,
            signedPrekeySignature: bundle.signedPrekeySignature.toString('base64'),
            registrationId: bundle.registrationId,
            oneTimePrekey: bundle.oneTimePrekey ? {
                keyId: bundle.oneTimePrekey.keyId,
                publicKey: bundle.oneTimePrekey.publicKey.toString('base64')
            } : null,
            e2eEnabled: true
        });

    } catch (error) {
        console.error('Get key bundle error:', error);
        return res.status(500).json({ error: 'Failed to get key bundle' });
    }
});

/**
 * GET /api/e2e/keys/check/:userId
 * Check if a user has E2E encryption enabled
 */
router.get('/keys/check/:userId', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const targetUserId = parseInt(req.params.userId, 10);

        if (isNaN(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const hasKeys = await E2EKeyRepository.hasRegisteredKeys(targetUserId);

        return res.json({ userId: targetUserId, e2eEnabled: hasKeys });

    } catch (error) {
        console.error('Check E2E status error:', error);
        return res.status(500).json({ error: 'Failed to check E2E status' });
    }
});

// ============================================
// SIGNED PREKEY ROTATION
// ============================================

/**
 * PUT /api/e2e/keys/signed-prekey
 * Rotate the signed prekey (should be done every 7-30 days)
 * 
 * Body: {
 *   signedPrekeyPublic: string (base64),
 *   signedPrekeyId: number,
 *   signedPrekeySignature: string (base64)
 * }
 */
router.put('/keys/signed-prekey', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { signedPrekeyPublic, signedPrekeyId, signedPrekeySignature } = req.body;

        if (!signedPrekeyPublic || !signedPrekeySignature || signedPrekeyId === undefined) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['signedPrekeyPublic', 'signedPrekeyId', 'signedPrekeySignature']
            });
        }

        const signedPrekeyBuffer = Buffer.from(signedPrekeyPublic, 'base64');
        const signatureBuffer = Buffer.from(signedPrekeySignature, 'base64');

        // Validate sizes
        if (signedPrekeyBuffer.length !== 32) {
            return res.status(400).json({ error: 'Invalid signed prekey size' });
        }
        if (signatureBuffer.length !== 64) {
            return res.status(400).json({ error: 'Invalid signature size' });
        }

        await E2EKeyRepository.updateSignedPrekey(
            userId,
            signedPrekeyBuffer,
            signedPrekeyId,
            signatureBuffer
        );

        return res.json({
            success: true,
            message: 'Signed prekey rotated successfully'
        });

    } catch (error) {
        console.error('Signed prekey rotation error:', error);
        return res.status(500).json({ error: 'Failed to rotate signed prekey' });
    }
});

// ============================================
// ONE-TIME PREKEYS
// ============================================

/**
 * POST /api/e2e/prekeys
 * Upload a batch of one-time prekeys
 * Client should maintain ~100 prekeys on server
 * 
 * Body: {
 *   prekeys: Array<{ keyId: number, publicKey: string (base64) }>
 * }
 */
router.post('/prekeys', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { prekeys } = req.body;

        if (!Array.isArray(prekeys) || prekeys.length === 0) {
            return res.status(400).json({ error: 'Prekeys array is required' });
        }

        if (prekeys.length > 100) {
            return res.status(400).json({ error: 'Maximum 100 prekeys per request' });
        }

        // Convert and validate
        const prekeysToUpload = prekeys.map((pk: { keyId: number; publicKey: string }) => {
            const publicKeyBuffer = Buffer.from(pk.publicKey, 'base64');
            if (publicKeyBuffer.length !== 32) {
                throw new Error(`Invalid prekey size for key ${pk.keyId}`);
            }
            return {
                keyId: pk.keyId,
                publicKey: publicKeyBuffer
            };
        });

        const uploaded = await E2EKeyRepository.uploadOneTimePrekeys(userId, prekeysToUpload);

        return res.json({
            success: true,
            uploadedCount: uploaded
        });

    } catch (error: any) {
        console.error('Upload prekeys error:', error);
        return res.status(500).json({ error: error.message || 'Failed to upload prekeys' });
    }
});

/**
 * GET /api/e2e/prekeys/count
 * Get count of available one-time prekeys
 * Client should refill when this drops below 25
 */
router.get('/prekeys/count', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const count = await E2EKeyRepository.getAvailablePrekeyCount(userId);

        return res.json({
            userId,
            availablePrekeys: count,
            needsRefill: count < 25
        });

    } catch (error) {
        console.error('Get prekey count error:', error);
        return res.status(500).json({ error: 'Failed to get prekey count' });
    }
});

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * POST /api/e2e/sessions
 * Store encrypted session state
 * Session is encrypted client-side, server cannot read it
 * 
 * Body: {
 *   peerUserId: number,
 *   roomId?: number (for group sessions),
 *   encryptedSessionState: string (base64)
 * }
 */
router.post('/sessions', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { peerUserId, roomId, encryptedSessionState } = req.body;

        if (!peerUserId || !encryptedSessionState) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['peerUserId', 'encryptedSessionState']
            });
        }

        const sessionBuffer = Buffer.from(encryptedSessionState, 'base64');

        await E2EKeyRepository.storeSession(
            userId,
            peerUserId,
            sessionBuffer,
            roomId
        );

        return res.json({
            success: true,
            message: 'Session stored successfully'
        });

    } catch (error) {
        console.error('Store session error:', error);
        return res.status(500).json({ error: 'Failed to store session' });
    }
});

/**
 * GET /api/e2e/sessions/:peerUserId
 * Get encrypted session state with a specific user
 */
router.get('/sessions/:peerUserId', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const peerUserId = parseInt(req.params.peerUserId, 10);
        const roomId = req.query.roomId ? parseInt(req.query.roomId as string, 10) : undefined;

        if (isNaN(peerUserId)) {
            return res.status(400).json({ error: 'Invalid peer user ID' });
        }

        const session = await E2EKeyRepository.getSession(userId, peerUserId, roomId);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        return res.json({
            peerUserId: session.peerUserId,
            roomId: session.roomId,
            encryptedSessionState: session.encryptedSessionState.toString('base64'),
            sessionVersion: session.sessionVersion
        });

    } catch (error) {
        console.error('Get session error:', error);
        return res.status(500).json({ error: 'Failed to get session' });
    }
});

/**
 * GET /api/e2e/sessions
 * Get all sessions (for sync/backup)
 */
router.get('/sessions', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const sessions = await E2EKeyRepository.getAllSessions(userId);

        return res.json({
            sessions: sessions.map(s => ({
                peerUserId: s.peerUserId,
                roomId: s.roomId,
                encryptedSessionState: s.encryptedSessionState.toString('base64'),
                sessionVersion: s.sessionVersion
            }))
        });

    } catch (error) {
        console.error('Get all sessions error:', error);
        return res.status(500).json({ error: 'Failed to get sessions' });
    }
});

/**
 * DELETE /api/e2e/sessions/:peerUserId
 * Delete a session
 */
router.delete('/sessions/:peerUserId', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const peerUserId = parseInt(req.params.peerUserId, 10);
        const roomId = req.query.roomId ? parseInt(req.query.roomId as string, 10) : undefined;

        if (isNaN(peerUserId)) {
            return res.status(400).json({ error: 'Invalid peer user ID' });
        }

        await E2EKeyRepository.deleteSession(userId, peerUserId, roomId);

        return res.json({
            success: true,
            message: 'Session deleted successfully'
        });

    } catch (error) {
        console.error('Delete session error:', error);
        return res.status(500).json({ error: 'Failed to delete session' });
    }
});

// ============================================
// DEVICE MANAGEMENT
// ============================================

/**
 * POST /api/e2e/devices
 * Register a new device
 * 
 * Body: {
 *   deviceId: string (UUID),
 *   deviceName?: string,
 *   identityPublicKey: string (base64),
 *   signedPrekeyPublic: string (base64),
 *   signedPrekeyId: number,
 *   signedPrekeySignature: string (base64),
 *   registrationId: number
 * }
 */
router.post('/devices', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const {
            deviceId,
            deviceName,
            identityPublicKey,
            signedPrekeyPublic,
            signedPrekeyId,
            signedPrekeySignature,
            registrationId
        } = req.body;

        if (!deviceId || !identityPublicKey || !signedPrekeyPublic || !signedPrekeySignature) {
            return res.status(400).json({ error: 'Missing required device key fields' });
        }

        await E2EKeyRepository.registerDevice(
            userId,
            deviceId,
            deviceName,
            Buffer.from(identityPublicKey, 'base64'),
            Buffer.from(signedPrekeyPublic, 'base64'),
            signedPrekeyId,
            Buffer.from(signedPrekeySignature, 'base64'),
            registrationId
        );

        return res.status(201).json({
            success: true,
            message: 'Device registered successfully',
            deviceId
        });

    } catch (error) {
        console.error('Register device error:', error);
        return res.status(500).json({ error: 'Failed to register device' });
    }
});

/**
 * GET /api/e2e/devices/:userId
 * Get all devices for a user (for multi-device encryption)
 */
router.get('/devices/:userId', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const targetUserId = parseInt(req.params.userId, 10);

        if (isNaN(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const devices = await E2EKeyRepository.getUserDevices(targetUserId);

        return res.json({
            userId: targetUserId,
            devices: devices.map(d => ({
                deviceId: d.deviceId,
                deviceName: d.deviceName,
                identityPublicKey: d.identityPublicKey.toString('base64'),
                signedPrekeyPublic: d.signedPrekeyPublic.toString('base64'),
                signedPrekeyId: d.signedPrekeyId,
                signedPrekeySignature: d.signedPrekeySignature.toString('base64'),
                registrationId: d.registrationId,
                isVerified: d.isVerified,
                lastSeen: d.lastSeenAt
            }))
        });

    } catch (error) {
        console.error('Get user devices error:', error);
        return res.status(500).json({ error: 'Failed to get user devices' });
    }
});

/**
 * POST /api/e2e/devices/:deviceId/verify
 * Verify a device (from current trusted device)
 */
router.post('/devices/:deviceId/verify', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const deviceId = req.params.deviceId;
        const { verifyingDeviceId } = req.body;

        if (!verifyingDeviceId) {
            return res.status(400).json({ error: 'Verifying device ID required' });
        }

        await E2EKeyRepository.verifyDevice(userId, deviceId, verifyingDeviceId);

        return res.json({
            success: true,
            message: 'Device verified successfully'
        });

    } catch (error) {
        console.error('Verify device error:', error);
        return res.status(500).json({ error: 'Failed to verify device' });
    }
});

/**
 * DELETE /api/e2e/devices/:deviceId
 * Remove a device
 */
router.delete('/devices/:deviceId', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const deviceId = req.params.deviceId;

        await E2EKeyRepository.removeDevice(userId, deviceId);

        return res.json({
            success: true,
            message: 'Device removed successfully'
        });

    } catch (error) {
        console.error('Remove device error:', error);
        return res.status(500).json({ error: 'Failed to remove device' });
    }
});

// ============================================
// GROUP SENDER KEYS
// ============================================

/**
 * POST /api/e2e/sender-keys
 * Store/update a sender key for group encryption
 * 
 * Body: {
 *   roomId: number,
 *   distributionKeyPublic: string (base64),
 *   distributionKeyId: number
 * }
 */
router.post('/sender-keys', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { roomId, distributionKeyPublic, distributionKeyId } = req.body;

        if (!roomId || !distributionKeyPublic || distributionKeyId === undefined) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['roomId', 'distributionKeyPublic', 'distributionKeyId']
            });
        }

        await E2EKeyRepository.storeSenderKey(
            roomId,
            userId,
            Buffer.from(distributionKeyPublic, 'base64'),
            distributionKeyId
        );

        return res.json({
            success: true,
            message: 'Sender key stored successfully'
        });

    } catch (error) {
        console.error('Store sender key error:', error);
        return res.status(500).json({ error: 'Failed to store sender key' });
    }
});

/**
 * GET /api/e2e/sender-keys/:roomId
 * Get all sender keys for a room
 */
router.get('/sender-keys/:roomId', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const roomId = parseInt(req.params.roomId, 10);

        if (isNaN(roomId)) {
            return res.status(400).json({ error: 'Invalid room ID' });
        }

        const senderKeys = await E2EKeyRepository.getRoomSenderKeys(roomId);

        return res.json({
            roomId,
            senderKeys: senderKeys.map(sk => ({
                senderUserId: sk.senderUserId,
                distributionKeyPublic: sk.distributionKeyPublic.toString('base64'),
                distributionKeyId: sk.distributionKeyId,
                chainIteration: sk.chainIteration
            }))
        });

    } catch (error) {
        console.error('Get sender keys error:', error);
        return res.status(500).json({ error: 'Failed to get sender keys' });
    }
});

// ============================================
// MULTI-DEVICE SUPPORT
// ============================================

// In-memory storage for linking codes (in production, use Redis)
const linkingCodes: Map<string, { userId: number; expiresAt: Date }> = new Map();
const linkRequests: Map<string, {
    userId: number;
    newDeviceId: string;
    newDeviceName: string;
    newDevicePublicKey: string;
    createdAt: Date;
    status: 'pending' | 'approved' | 'rejected';
}> = new Map();

/**
 * POST /api/e2e/devices/linking-code
 * Generate a temporary code for linking a new device
 */
router.post('/devices/linking-code', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;

        // Generate a 6-digit code
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store the code
        linkingCodes.set(code, { userId, expiresAt });

        // Clean up expired codes
        for (const [c, data] of linkingCodes.entries()) {
            if (data.expiresAt < new Date()) {
                linkingCodes.delete(c);
            }
        }

        return res.json({
            code,
            expiresAt: expiresAt.toISOString(),
        });

    } catch (error) {
        console.error('Generate linking code error:', error);
        return res.status(500).json({ error: 'Failed to generate linking code' });
    }
});

/**
 * POST /api/e2e/devices/link
 * Link a new device using a linking code
 */
router.post('/devices/link', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { linkingCode, newDeviceId, newDeviceName, newDevicePublicKey } = req.body;

        if (!linkingCode || !newDeviceId || !newDeviceName || !newDevicePublicKey) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify the linking code
        const codeData = linkingCodes.get(linkingCode);
        if (!codeData) {
            return res.status(400).json({ error: 'Invalid linking code' });
        }

        if (codeData.expiresAt < new Date()) {
            linkingCodes.delete(linkingCode);
            return res.status(400).json({ error: 'Linking code expired' });
        }

        if (codeData.userId !== userId) {
            return res.status(403).json({ error: 'Linking code belongs to another user' });
        }

        // Create a link request for approval
        const requestId = Math.random().toString(36).substring(2, 15);
        linkRequests.set(requestId, {
            userId,
            newDeviceId,
            newDeviceName,
            newDevicePublicKey,
            createdAt: new Date(),
            status: 'pending',
        });

        // Delete the used code
        linkingCodes.delete(linkingCode);

        return res.json({
            success: true,
            requestId,
            message: 'Link request created. Please approve on your existing device.',
        });

    } catch (error) {
        console.error('Link device error:', error);
        return res.status(500).json({ error: 'Failed to link device' });
    }
});

/**
 * GET /api/e2e/devices/link-requests/:requestId/status
 * Check status of a link request (called by new device)
 */
router.get('/devices/link-requests/:requestId/status', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { requestId } = req.params;

        const request = linkRequests.get(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Link request not found' });
        }

        if (request.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        return res.json({
            status: request.status,
        });

    } catch (error) {
        console.error('Get link request status error:', error);
        return res.status(500).json({ error: 'Failed to get link request status' });
    }
});

/**
 * GET /api/e2e/devices/link-requests
 * Get pending device link requests
 */
router.get('/devices/link-requests', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;

        const requests: Array<{
            requestId: string;
            newDeviceId: string;
            newDeviceName: string;
            newDeviceFingerprint: string;
            createdAt: string;
        }> = [];

        for (const [requestId, data] of linkRequests.entries()) {
            if (data.userId === userId) {
                // Generate fingerprint from public key
                const fingerprint = data.newDevicePublicKey.substring(0, 16).toUpperCase();

                requests.push({
                    requestId,
                    newDeviceId: data.newDeviceId,
                    newDeviceName: data.newDeviceName,
                    newDeviceFingerprint: fingerprint,
                    createdAt: data.createdAt.toISOString(),
                });
            }
        }

        return res.json({ requests });

    } catch (error) {
        console.error('Get link requests error:', error);
        return res.status(500).json({ error: 'Failed to get link requests' });
    }
});

/**
 * POST /api/e2e/devices/link-requests/:requestId/respond
 * Approve or reject a device link request
 */
router.post('/devices/link-requests/:requestId/respond', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { requestId } = req.params;
        const { approved } = req.body;

        const request = linkRequests.get(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Link request not found' });
        }

        if (request.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (approved) {
            request.status = 'approved';
            // The device will complete registration on its own
            return res.json({
                success: true,
                message: 'Device link approved',
            });
        } else {
            request.status = 'rejected';
            // We can keep rejected requests for a bit so client knows, or delete immediately
            // Let's keep for polling client to see rejection
            return res.json({
                success: true,
                message: 'Device link rejected',
            });
        }

    } catch (error) {
        console.error('Respond to link request error:', error);
        return res.status(500).json({ error: 'Failed to respond to link request' });
    }
});

/**
 * GET /api/e2e/keys/user/:userId/devices
 * Get all device key bundles for a user (for multi-device messaging)
 */
router.get('/keys/user/:userId/devices', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const targetUserId = parseInt(req.params.userId, 10);

        if (isNaN(targetUserId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Get all devices for the user
        const devices = await E2EKeyRepository.getUserDevices(targetUserId);

        return res.json({
            userId: targetUserId,
            devices: devices.map(d => ({
                device_id: d.deviceId,
                device_name: d.deviceName,
                identity_public_key: d.identityPublicKey.toString('base64'),
                signed_prekey_public: d.signedPrekeyPublic.toString('base64'),
                signed_prekey_id: d.signedPrekeyId,
                signed_prekey_signature: d.signedPrekeySignature.toString('base64'),
                registration_id: d.registrationId,
                is_verified: d.isVerified,
            })),
        });

    } catch (error) {
        console.error('Get user devices error:', error);
        return res.status(500).json({ error: 'Failed to get user devices' });
    }
});

/**
 * POST /api/e2e/backup
 * Upload encrypted key backup
 */
router.post('/backup', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { backupData } = req.body;

        if (!backupData || typeof backupData !== 'string') {
            return res.status(400).json({ error: 'Invalid backup data' });
        }

        await E2EKeyRepository.saveBackup(userId, backupData);

        return res.json({ success: true, message: 'Backup uploaded' });
    } catch (error) {
        console.error('Upload backup error:', error);
        return res.status(500).json({ error: 'Failed to upload backup' });
    }
});

/**
 * GET /api/e2e/backup
 * Retrieve encrypted key backup
 */
router.get('/backup', authenticateTokenHTTP, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.userId;

        const backup = await E2EKeyRepository.getBackup(userId);

        if (!backup) {
            return res.status(404).json({ error: 'No backup found' });
        }

        return res.json(backup);
    } catch (error) {
        console.error('Get backup error:', error);
        return res.status(500).json({ error: 'Failed to retrieve backup' });
    }
});

export default router;
