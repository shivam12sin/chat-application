import express, { Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import initializeSocket from './socket';
import Database from './config/database';
import { redisClient, RedisService } from './config/redis';
import authRoutes from './routes/auth';
import messageRoutes from './routes/messages';
import roomRoutes from './routes/rooms';
import uploadRoutes from './routes/upload';
import healthRoutes from './routes/health';
import { logInfo } from './config/logger';
import { errorHandler, requestIdMiddleware, notFoundHandler } from './middleware/errorHandler';
import { metricsMiddleware } from './middleware/metrics';
import metricsRoutes from './routes/metrics';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// ============================================
// Middleware
// ============================================
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request ID middleware (for tracing)
app.use(requestIdMiddleware);

// Metrics middleware (collect HTTP metrics)
app.use(metricsMiddleware);

// Request logging
app.use((req: Request, res: Response, next) => {
    const start = Date.now();
    res.on('finish', () => {
        logInfo('Request completed', {
            requestId: (req as any).requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
        });
    });
    next();
});

// ============================================
// Routes
// ============================================
import contactRoutes from './routes/contacts';
import reactionRoutes from './routes/reactions';
import searchRoutes from './routes/search';
import blocksRoutes from './routes/blocks';
import e2eRoutes from './routes/e2e';
import { authLimiter, messageLimiter, uploadLimiter, searchLimiter, standardLimiter } from './middleware/rateLimit';

// Apply standard rate limiting to all routes
app.use('/api', standardLimiter);

// Auth routes with stricter rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);

// Other routes with specific rate limits
app.use('/api/messages', messageLimiter, messageRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/upload', uploadLimiter, uploadRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/search', searchLimiter, searchRoutes);
app.use('/api', blocksRoutes);  // /api/users/:id/block, /api/blocked, /api/users/:id/mute, /api/muted, etc.
app.use('/api/e2e', e2eRoutes);  // E2E encryption key management

// Spotify integration (secure token generation)
import spotifyRoutes from './routes/spotify';
app.use('/api/spotify', spotifyRoutes);

// Health check routes

app.use('/health', healthRoutes);

// Metrics endpoint (for Prometheus scraping)
app.use('/metrics', metricsRoutes);

// 404 handler
app.use(notFoundHandler);

// Centralized error handler (must be last)
app.use(errorHandler);

// ============================================
// Initialize Socket.io with Redis Adapter
// ============================================
const io = initializeSocket(httpServer);
global.io = io;

// ============================================
// Start Server
// ============================================
import { ReactionRepository } from './repositories/ReactionRepository';
import { MessageDeleteRepository } from './repositories/MessageDeleteRepository';
import { ScheduledMessageRepository } from './repositories/ScheduledMessageRepository';
import { initializeElasticsearchIndex } from './config/elasticsearch';

// Declare global io
declare global {
    var io: any;
}

async function startServer() {
    try {
        // Test database connection
        const dbHealthy = await Database.healthCheck();
        if (!dbHealthy) {
            throw new Error('Database connection failed');
        }
        console.log('Database connected');

        // Initialize reactions table
        await ReactionRepository.initTable();
        console.log('Reactions table initialized');

        // Initialize message delete tables
        await MessageDeleteRepository.initTables();
        console.log('Message delete tables initialized');

        // Test Redis connection
        const redisHealthy = await RedisService.healthCheck();
        if (!redisHealthy) {
            throw new Error('Redis connection failed');
        }

        // Initialize Elasticsearch (non-blocking, app works without it)
        initializeElasticsearchIndex().catch(err => {
            console.warn('Elasticsearch init skipped (will use PostgreSQL fallback):', err.message);
        });

        // Background job: Process expired deletes every 2 seconds
        setInterval(async () => {
            try {
                const count = await MessageDeleteRepository.processExpiredDeletes();
                if (count > 0) {
                    console.log(`Hard deleted ${count} expired messages`);
                }
            } catch (err) {
                console.error('Error processing expired deletes:', err);
            }
        }, 2000);

        // Background job: Process scheduled messages every 10 seconds
        setInterval(async () => {
            try {
                // Poll for due messages (concurrency safe via SKIP LOCKED)
                const dueMessages = await ScheduledMessageRepository.pollDueMessages(50);

                if (dueMessages.length > 0) {
                    console.log(`Processing ${dueMessages.length} scheduled messages`);

                    for (const msg of dueMessages) {
                        try {
                            // 1. Create the actual message
                            const result = await Database.query(
                                `INSERT INTO messages (room_id, user_id, content, media_url, created_at)
                                 VALUES ($1, $2, $3, $4, $5)
                                 RETURNING *`,
                                [msg.room_id, msg.sender_id, msg.content, msg.media_url, new Date()]
                            );
                            const newMessage = result.rows[0];

                            // 2. Fetch sender info for socket event
                            const sender = await Database.query('SELECT username FROM users WHERE id = $1', [msg.sender_id]);
                            const username = sender.rows[0]?.username || 'User';

                            // 3. Emit via Socket.io
                            if (global.io) {
                                global.io.to(`room:${msg.room_id}`).emit('message:new', {
                                    ...newMessage,
                                    sender: {
                                        id: msg.sender_id,
                                        username: username,
                                    },
                                });
                            }

                            // 4. Mark as sent
                            await ScheduledMessageRepository.markAsSent(msg.id);

                        } catch (err) {
                            console.error(`Failed to send scheduled message ${msg.id}:`, err);
                            await ScheduledMessageRepository.markAsFailed(msg.id, err instanceof Error ? err.message : 'Unknown error');
                        }
                    }
                }
            } catch (err) {
                console.error('Error processing scheduled messages:', err);
            }
        }, 10000);

        httpServer.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('High-Scale Chat Server Started');
            console.log('='.repeat(50));
            console.log(`Server: http://localhost:${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Instance: ${process.env.SERVER_INSTANCE_ID || 'default'}`);
            console.log(`Redis Adapter: ENABLED (Horizontal Scaling Ready)`);
            console.log('='.repeat(50));
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');

    httpServer.close(async () => {
        await Database.close();
        await redisClient.quit();
        console.log('Server shut down successfully');
        process.exit(0);
    });
});

startServer();

export { io };
