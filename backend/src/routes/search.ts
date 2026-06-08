import { Router, Request, Response } from 'express';
import { SearchRepository } from '../repositories/SearchRepository';
import jwt from 'jsonwebtoken';

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
 * Search messages within a room
 * GET /api/search/messages?q=<query>&roomId=<roomId>&sender=<username>&before=<date>&after=<date>&limit=20&offset=0
 */
router.get('/messages', authMiddleware, async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string || '';
        const roomId = parseInt(req.query.roomId as string);
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        // Parse filters
        const filters = {
            sender: req.query.sender as string | undefined,
            before: req.query.before as string | undefined,
            after: req.query.after as string | undefined
        };

        if (!roomId) {
            res.status(400).json({ error: 'Room ID is required' });
            return;
        }

        // Allow empty query if filters are provided
        if (!query.trim() && !filters.sender && !filters.before && !filters.after) {
            res.status(400).json({ error: 'Search query or filters are required' });
            return;
        }

        const result = await SearchRepository.searchInRoom(roomId, query.trim(), limit, offset, filters);

        res.json({
            results: result.results,
            total: result.total,
            hasMore: offset + result.results.length < result.total
        });

    } catch (error) {
        console.error('Search error:', error);
        // Fallback to simple search if FTS fails
        try {
            const query = req.query.q as string;
            const roomId = parseInt(req.query.roomId as string);
            const results = await SearchRepository.searchSimple(roomId, query.trim(), 20);
            res.json({ results, total: results.length, hasMore: false });
        } catch (fallbackError) {
            res.status(500).json({ error: 'Search failed' });
        }
    }
});

/**
 * Global search across all user's rooms
 * GET /api/search/global?q=<query>&limit=20&offset=0
 */
router.get('/global', authMiddleware, async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;
        const userId = (req as any).userId;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        if (!query || query.trim().length === 0) {
            res.status(400).json({ error: 'Search query is required' });
            return;
        }

        const result = await SearchRepository.searchGlobal(userId, query.trim(), limit, offset);

        res.json({
            results: result.results,
            total: result.total,
            hasMore: offset + result.results.length < result.total
        });

    } catch (error) {
        console.error('Global search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;
