import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { AuthenticatedSocket } from '../socket';

interface JWTPayload {
    userId: number;
    username: string;
}

/**
 * Authentication middleware for Socket.io
 * Verifies JWT token from handshake auth or query params
 */
export const authenticateToken = async (
    socket: Socket,
    next: (err?: Error) => void
): Promise<void> => {
    try {
        // Get token from handshake auth or query
        const token =
            socket.handshake.auth.token ||
            socket.handshake.query.token as string;

        if (!token) {
            return next(new Error('Authentication token missing'));
        }

        // Verify JWT token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET not configured');
        }

        const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

        // Attach user info to socket
        (socket as AuthenticatedSocket).userId = decoded.userId;
        (socket as AuthenticatedSocket).username = decoded.username;

        next();

    } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
    }
};

import { Request, Response, NextFunction } from 'express';

/**
 * Authentication middleware for Express
 */
export const authenticateTokenHTTP = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'Authentication token missing' });
        return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET not configured');
        res.status(500).json({ error: 'Internal server error' });
        return;
    }

    try {
        const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
        // Attach user info to request (extend Request type if needed, or use as any)
        (req as any).user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid token' });
        return;
    }
};
