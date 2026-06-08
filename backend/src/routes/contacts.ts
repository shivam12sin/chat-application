import { Router, Request, Response } from 'express';
import { authenticateTokenHTTP } from '../middleware/auth';
import { ContactsRepository } from '../repositories/ContactsRepository';

const router = Router();

// Define user type on request (as used in middleware)
interface AuthRequest extends Request {
    user?: {
        userId: number;
        username: string;
    };
}

// Search users
router.get('/search', authenticateTokenHTTP, async (req: AuthRequest, res: Response) => {
    try {
        const { query } = req.query;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query parameter required' });
        }

        const users = await ContactsRepository.searchUsers(query, req.user!.userId);

        // Add connection status
        const results = await Promise.all(users.map(async (u) => {
            const status = await ContactsRepository.getConnectionStatus(req.user!.userId, u.id);
            return { ...u, status };
        }));

        return res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ error: 'Search failed' });
    }
});

// Send Request
router.post('/request', authenticateTokenHTTP, async (req: AuthRequest, res: Response) => {
    try {
        const { receiverId } = req.body;
        if (!receiverId) return res.status(400).json({ error: 'Receiver ID required' });

        if (receiverId === req.user!.userId) {
            return res.status(400).json({ error: 'Cannot send request to self' });
        }

        const request = await ContactsRepository.sendRequest(req.user!.userId, receiverId);
        return res.json(request);
    } catch (error: any) {
        if (error.message.includes('Connection status is not empty')) {
            return res.status(400).json({ error: 'Request already exists or users are connected' });
        }
        console.error('Send request error:', error);
        return res.status(500).json({ error: 'Failed to send request' });
    }
});

// Accept Request
router.post('/request/:id/accept', authenticateTokenHTTP, async (req: AuthRequest, res: Response) => {
    try {
        const requestId = parseInt(req.params.id);
        const result = await ContactsRepository.acceptRequest(requestId, req.user!.userId);
        return res.json(result);
    } catch (error) {
        console.error('Accept request error:', error);
        return res.status(500).json({ error: 'Failed to accept request' });
    }
});

// Reject Request
router.post('/request/:id/reject', authenticateTokenHTTP, async (req: AuthRequest, res: Response) => {
    try {
        const requestId = parseInt(req.params.id);
        const success = await ContactsRepository.rejectRequest(requestId, req.user!.userId);
        if (success) {
            return res.json({ success: true });
        } else {
            return res.status(404).json({ error: 'Request not found' });
        }
    } catch (error) {
        console.error('Reject request error:', error);
        return res.status(500).json({ error: 'Failed to reject request' });
    }
});

// Get Pending Requests
router.get('/requests', authenticateTokenHTTP, async (req: AuthRequest, res: Response) => {
    try {
        const requests = await ContactsRepository.getPendingRequests(req.user!.userId);
        return res.json(requests);
    } catch (error) {
        console.error('Get requests error:', error);
        return res.status(500).json({ error: 'Failed to get requests' });
    }
});

// Get Contacts
router.get('/', authenticateTokenHTTP, async (req: AuthRequest, res: Response) => {
    try {
        const contacts = await ContactsRepository.getContacts(req.user!.userId);
        return res.json(contacts);
    } catch (error) {
        console.error('Get contacts error:', error);
        return res.status(500).json({ error: 'Failed to get contacts' });
    }
});

export default router;
