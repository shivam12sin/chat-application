import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { MessageRepository } from '../repositories/MessageRepository';
import { MessageDeleteRepository } from '../repositories/MessageDeleteRepository';
import { ScheduledMessageRepository } from '../repositories/ScheduledMessageRepository';

const router = Router();

// Auth middleware with user extraction
const authMiddleware = (req: Request, res: Response, next: any): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('SECURITY: JWT_SECRET not configured');
        res.status(500).json({ error: 'Server configuration error' });
        return;
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, jwtSecret) as any;
        (req as any).userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

/**
 * Get messages for a room with cursor-based pagination
 * GET /api/messages/room/:roomId?cursor=<messageId>&limit=50
 */
router.get('/room/:roomId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const roomId = parseInt(req.params.roomId);
        const cursor = req.query.cursor as string | undefined;
        const limit = parseInt(req.query.limit as string) || 50;

        const result = await MessageRepository.getMessagesByRoom(roomId, limit, cursor);

        res.json(result);

    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

/**
 * Get message receipts
 */
router.get('/:messageId/receipts', authMiddleware, async (req: Request, res: Response) => {
    try {
        const messageId = req.params.messageId;
        const receipts = await MessageRepository.getMessageReceipts(messageId);

        res.json({ receipts });

    } catch (error) {
        console.error('Get receipts error:', error);
        res.status(500).json({ error: 'Failed to fetch receipts' });
    }
});

/**
 * Delete a message
 * DELETE /api/messages/:id
 * Body: { mode: 'me' | 'everyone', roomId: number }
 */
router.delete('/:messageId', authMiddleware, async (req: Request, res: Response) => {
    try {
        const messageId = req.params.messageId;
        const userId = (req as any).userId;
        const { mode, roomId } = req.body;

        if (!mode || !['me', 'everyone'].includes(mode)) {
            res.status(400).json({ error: 'Invalid delete mode' });
            return;
        }

        // Get message to verify ownership
        const message = await MessageRepository.getMessageById(messageId);
        if (!message) {
            res.status(404).json({ error: 'Message not found' });
            return;
        }

        if (mode === 'me') {
            // Hide message for current user only
            await MessageDeleteRepository.hideForUser(messageId, userId);
            res.json({ success: true });
        } else {
            // Delete for everyone - only sender can do this
            if (message.sender_id !== userId) {
                res.status(403).json({ error: 'Only the sender can delete for everyone' });
                return;
            }

            // Schedule deletion with 7s undo window
            const { undoToken, expiresAt } = await MessageDeleteRepository.scheduleDelete(
                messageId,
                userId,
                roomId || message.room_id,
                message
            );

            res.json({
                success: true,
                undoToken,
                expiresAt: expiresAt.toISOString()
            });
        }

    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

/**
 * Undo a pending delete
 * POST /api/messages/:undoToken/undo
 */
router.post('/:undoToken/undo', authMiddleware, async (req: Request, res: Response) => {
    try {
        const undoToken = req.params.undoToken;
        const userId = (req as any).userId;

        const success = await MessageDeleteRepository.undoDelete(undoToken, userId);

        if (success) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Undo expired or not found' });
        }

    } catch (error) {
        console.error('Undo delete error:', error);
        res.status(500).json({ error: 'Failed to undo delete' });
    }
});

/**
 * Unhide a message for user (undo "Delete for Me")
 * POST /api/messages/:messageId/unhide
 */
router.post('/:messageId/unhide', authMiddleware, async (req: Request, res: Response) => {
    try {
        const messageId = req.params.messageId;
        const userId = (req as any).userId;

        await MessageDeleteRepository.unhideForUser(messageId, userId);
        res.json({ success: true });

    } catch (error) {
        console.error('Unhide message error:', error);
        res.status(500).json({ error: 'Failed to unhide message' });
    }
});



/**
 * Schedule a message
 * POST /api/messages/schedule
 */
router.post('/schedule', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        const { roomId, content, scheduledAt, mediaUrl } = req.body;

        if (!roomId || !content || !scheduledAt) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
            res.status(400).json({ error: 'Invalid scheduledAt date' });
            return;
        }

        if (scheduledDate <= new Date()) {
            res.status(400).json({ error: 'Scheduled time must be in the future' });
            return;
        }

        const message = await ScheduledMessageRepository.scheduleMessage(
            userId,
            roomId,
            content,
            scheduledDate,
            mediaUrl
        );

        res.json({ success: true, message });

    } catch (error) {
        console.error('Schedule message error:', error);
        res.status(500).json({ error: 'Failed to schedule message' });
    }
});

export default router;

