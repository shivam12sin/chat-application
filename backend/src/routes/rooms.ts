import { Router, Request, Response } from 'express';
import { RoomRepository } from '../repositories/RoomRepository';
import { apiAuthMiddleware } from '../middleware/apiAuth';

const router = Router();

/**
 * Get all rooms for authenticated user
 */
router.get('/', apiAuthMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;

        const rooms = await RoomRepository.getUserRooms(userId);

        res.json({ rooms });

    } catch (error) {
        console.error('Get rooms error:', error);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
});

/**
 * Create a new room
 */
router.post('/', apiAuthMiddleware, async (req: Request, res: Response) => {
    try {
        const { roomType, name, members } = req.body;
        const userId = req.user!.userId;

        const room = await RoomRepository.createRoom(roomType, userId, name);

        // Add creator and members
        await RoomRepository.addUserToRoom(room.id, userId, 'admin');

        if (members && Array.isArray(members)) {
            for (const memberId of members) {
                await RoomRepository.addUserToRoom(room.id, memberId, 'member');
            }
        }

        res.status(201).json({ room });

    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({ error: 'Failed to create room' });
    }
});

/**
 * Get room members
 */
router.get('/:roomId/members', apiAuthMiddleware, async (req: Request, res: Response) => {
    try {
        const roomId = parseInt(req.params.roomId);
        const members = await RoomRepository.getRoomMembers(roomId);

        res.json({ members });

    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
});

export default router;
