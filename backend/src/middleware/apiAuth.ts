import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JWTPayload {
    userId: number;
    username: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
        }
    }
}

export const apiAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }

        const token = authHeader.split(' ')[1]; // Bearer <token>
        if (!token) {
            res.status(401).json({ error: 'Invalid token format' });
            return;
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET not configured');
        }

        const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
        req.user = decoded;

        next();
    } catch (error) {
        console.error('API Auth error:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};
