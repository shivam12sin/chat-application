import winston from 'winston';

const { combine, timestamp, json, colorize, printf } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        json()
    ),
    defaultMeta: { service: 'chat-api' },
    transports: [
        // Console transport
        new winston.transports.Console({
            format: process.env.NODE_ENV === 'production'
                ? combine(timestamp(), json())
                : combine(timestamp(), colorize(), devFormat),
        }),
        // Could add file transport or external service here
        // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        // new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});

// Add request context helper
export const createRequestLogger = (requestId: string, userId?: number) => {
    return logger.child({ requestId, userId });
};

// Structured logging helpers
export const logInfo = (message: string, meta?: Record<string, unknown>) => {
    logger.info(message, meta);
};

export const logError = (message: string, error?: Error, meta?: Record<string, unknown>) => {
    logger.error(message, {
        ...meta,
        error: error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
        } : undefined,
    });
};

export const logWarn = (message: string, meta?: Record<string, unknown>) => {
    logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: Record<string, unknown>) => {
    logger.debug(message, meta);
};

export default logger;
