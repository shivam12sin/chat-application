import { Router, Request, Response } from 'express';
import { BlockRepository } from '../repositories/BlockRepository';
import { MuteRepository } from '../repositories/MuteRepository';
import { authenticateTokenHTTP } from '../middleware/auth';

const router = Router();

// ============================================
// BLOCK ENDPOINTS
// ============================================

/**
 * Block a user
 * POST /api/users/:id/block
 */
router.post('/users/:id/block', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const blockedId = parseInt(req.params.id);

        if (userId === blockedId) {
            res.status(400).json({ error: 'Cannot block yourself' });
            return;
        }

        await BlockRepository.blockUser(userId, blockedId);
        res.json({ success: true, message: 'User blocked' });
    } catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({ error: 'Failed to block user' });
    }
});

/**
 * Unblock a user
 * POST /api/users/:id/unblock
 */
router.post('/users/:id/unblock', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const blockedId = parseInt(req.params.id);

        const removed = await BlockRepository.unblockUser(userId, blockedId);
        if (removed) {
            res.json({ success: true, message: 'User unblocked' });
        } else {
            res.status(404).json({ error: 'User was not blocked' });
        }
    } catch (error) {
        console.error('Unblock user error:', error);
        res.status(500).json({ error: 'Failed to unblock user' });
    }
});

/**
 * Get list of blocked users
 * GET /api/blocked
 */
router.get('/blocked', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const blockedUsers = await BlockRepository.getBlockedUsers(userId);
        res.json(blockedUsers);
    } catch (error) {
        console.error('Get blocked users error:', error);
        res.status(500).json({ error: 'Failed to get blocked users' });
    }
});

// ============================================
// MUTE ENDPOINTS
// ============================================

/**
 * Mute a user
 * POST /api/users/:id/mute
 * Body: { until?: string } (ISO date string or null for permanent)
 */
router.post('/users/:id/mute', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const mutedUserId = parseInt(req.params.id);
        const until = req.body.until ? new Date(req.body.until) : undefined;

        if (userId === mutedUserId) {
            res.status(400).json({ error: 'Cannot mute yourself' });
            return;
        }

        await MuteRepository.muteUser(userId, mutedUserId, until);
        res.json({ success: true, message: 'User muted' });
    } catch (error) {
        console.error('Mute user error:', error);
        res.status(500).json({ error: 'Failed to mute user' });
    }
});

/**
 * Unmute a user
 * POST /api/users/:id/unmute
 */
router.post('/users/:id/unmute', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const mutedUserId = parseInt(req.params.id);

        const removed = await MuteRepository.unmuteUser(userId, mutedUserId);
        if (removed) {
            res.json({ success: true, message: 'User unmuted' });
        } else {
            res.status(404).json({ error: 'User was not muted' });
        }
    } catch (error) {
        console.error('Unmute user error:', error);
        res.status(500).json({ error: 'Failed to unmute user' });
    }
});

/**
 * Mute a room
 * POST /api/rooms/:id/mute
 * Body: { until?: string }
 */
router.post('/rooms/:id/mute', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const roomId = parseInt(req.params.id);
        const until = req.body.until ? new Date(req.body.until) : undefined;

        await MuteRepository.muteRoom(userId, roomId, until);
        res.json({ success: true, message: 'Room muted' });
    } catch (error) {
        console.error('Mute room error:', error);
        res.status(500).json({ error: 'Failed to mute room' });
    }
});

/**
 * Unmute a room
 * POST /api/rooms/:id/unmute
 */
router.post('/rooms/:id/unmute', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const roomId = parseInt(req.params.id);

        const removed = await MuteRepository.unmuteRoom(userId, roomId);
        if (removed) {
            res.json({ success: true, message: 'Room unmuted' });
        } else {
            res.status(404).json({ error: 'Room was not muted' });
        }
    } catch (error) {
        console.error('Unmute room error:', error);
        res.status(500).json({ error: 'Failed to unmute room' });
    }
});

/**
 * Get list of muted users and rooms
 * GET /api/muted
 */
router.get('/muted', authenticateTokenHTTP, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const mutedList = await MuteRepository.getMutedList(userId);
        res.json(mutedList);
    } catch (error) {
        console.error('Get muted list error:', error);
        res.status(500).json({ error: 'Failed to get muted list' });
    }
});

export default router;
