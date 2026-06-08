/**
 * Metrics middleware - automatically collects HTTP metrics
 */

import { Request, Response, NextFunction } from 'express';
import { recordHttpRequest } from '../services/MetricsService';

/**
 * Middleware to record HTTP request metrics
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    // Record metrics when response finishes
    res.on('finish', () => {
        const duration = Date.now() - start;
        recordHttpRequest(req.method, req.path, res.statusCode, duration);
    });

    next();
};
