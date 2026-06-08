import { Router, Request, Response, NextFunction } from 'express';
import { ReactionRepository } from '../repositories/ReactionRepository';
import { authenticateTokenHTTP } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateTokenHTTP);

/**
 * POST /api/reactions/:messageId
 * Add or toggle a reaction on a message
 */
router.post('/:messageId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const userId = (req as any).user.userId;

        if (!emoji) {
            res.status(400).json({ error: 'Emoji is required' });
            return;
        }

        const result = await ReactionRepository.toggleReaction(messageId, userId, emoji);
        const reactions = await ReactionRepository.getReactionsForMessage(messageId);

        res.json({
            success: true,
            added: result.added,
            reactions
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/reactions/:messageId
 * Get all reactions for a message
 */
router.get('/:messageId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { messageId } = req.params;
        const reactions = await ReactionRepository.getReactionsForMessage(messageId);

        res.json({ reactions });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/reactions/:messageId/:emoji
 * Remove a specific reaction
 */
router.delete('/:messageId/:emoji', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { messageId, emoji } = req.params;
        const userId = (req as any).user.id;

        const removed = await ReactionRepository.removeReaction(messageId, userId, decodeURIComponent(emoji));
        const reactions = await ReactionRepository.getReactionsForMessage(messageId);

        res.json({
            success: removed,
            reactions
        });
    } catch (error) {
        next(error);
    }
});

export default router;
