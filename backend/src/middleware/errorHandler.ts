import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../utils/errors';
import { logError } from '../config/logger';

/**
 * Standardized error response format
 */
interface ErrorResponse {
    success: false;
    error: {
        message: string;
        code?: string;
        errors?: Record<string, string[]>;
    };
    requestId?: string;
}

/**
 * Centralized error handling middleware
 * Must be registered AFTER all routes
 */
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    const requestId = (req as any).requestId;

    // Log the error
    logError('Request error', err, {
        requestId,
        path: req.path,
        method: req.method,
        userId: (req as any).user?.userId,
    });

    // Handle Zod validation errors
    if (err instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        err.issues.forEach((issue) => {
            const path = issue.path.join('.');
            if (!errors[path]) errors[path] = [];
            errors[path].push(issue.message);
        });

        const response: ErrorResponse = {
            success: false,
            error: {
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                errors,
            },
            requestId,
        };

        res.status(400).json(response);
        return;
    }

    // Handle custom AppError
    if (err instanceof AppError) {
        const response: ErrorResponse = {
            success: false,
            error: {
                message: err.message,
                code: err.code,
                ...(err instanceof ValidationError && { errors: err.errors }),
            },
            requestId,
        };

        res.status(err.statusCode).json(response);
        return;
    }

    // Handle unknown errors (don't leak internal details in production)
    const isProduction = process.env.NODE_ENV === 'production';
    const response: ErrorResponse = {
        success: false,
        error: {
            message: isProduction ? 'Internal server error' : err.message,
            code: 'INTERNAL_ERROR',
        },
        requestId,
    };

    res.status(500).json(response);
};

/**
 * Request ID middleware - adds unique ID to each request
 */
export const requestIdMiddleware = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    (req as any).requestId = crypto.randomUUID();
    next();
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (
    req: Request,
    res: Response
): void => {
    res.status(404).json({
        success: false,
        error: {
            message: `Route ${req.method} ${req.path} not found`,
            code: 'NOT_FOUND',
        },
    });
};
