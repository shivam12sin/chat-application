/**
 * Custom error classes for the application
 */

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly code?: string;

    constructor(
        message: string,
        statusCode: number = 500,
        code?: string,
        isOperational: boolean = true
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;

        Object.setPrototypeOf(this, AppError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    public readonly errors: Record<string, string[]>;

    constructor(message: string, errors: Record<string, string[]> = {}) {
        super(message, 400, 'VALIDATION_ERROR');
        this.errors = errors;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = 'Permission denied') {
        super(message, 403, 'AUTHORIZATION_ERROR');
        Object.setPrototypeOf(this, AuthorizationError.prototype);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

export class ConflictError extends AppError {
    constructor(message: string = 'Resource already exists') {
        super(message, 409, 'CONFLICT');
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}

export class RateLimitError extends AppError {
    public readonly retryAfter: number;

    constructor(retryAfter: number = 60) {
        super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
        this.retryAfter = retryAfter;
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}
