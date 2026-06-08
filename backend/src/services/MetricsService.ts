/**
 * Metrics Service - Prometheus-compatible metrics for observability
 * Provides HTTP, WebSocket, and business metrics
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a custom registry
export const metricsRegistry = new Registry();

// Add default Node.js metrics (memory, CPU, event loop)
collectDefaultMetrics({ register: metricsRegistry });

// ============================================
// HTTP Metrics
// ============================================

/**
 * HTTP request counter by path, method, and status
 */
export const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status_code'],
    registers: [metricsRegistry],
});

/**
 * HTTP request duration histogram
 */
export const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [metricsRegistry],
});

// ============================================
// WebSocket Metrics
// ============================================

/**
 * Active WebSocket connections
 */
export const wsConnectionsActive = new Gauge({
    name: 'websocket_connections_active',
    help: 'Number of active WebSocket connections',
    registers: [metricsRegistry],
});

/**
 * WebSocket connections total
 */
export const wsConnectionsTotal = new Counter({
    name: 'websocket_connections_total',
    help: 'Total WebSocket connections established',
    registers: [metricsRegistry],
});

/**
 * WebSocket disconnections
 */
export const wsDisconnectionsTotal = new Counter({
    name: 'websocket_disconnections_total',
    help: 'Total WebSocket disconnections',
    labelNames: ['reason'],
    registers: [metricsRegistry],
});

// ============================================
// Business Metrics
// ============================================

/**
 * Messages sent counter
 */
export const messagesSentTotal = new Counter({
    name: 'messages_sent_total',
    help: 'Total messages sent',
    labelNames: ['room_type', 'message_type'],
    registers: [metricsRegistry],
});

/**
 * Active users gauge
 */
export const activeUsers = new Gauge({
    name: 'active_users',
    help: 'Number of currently active users',
    registers: [metricsRegistry],
});

/**
 * Rooms active gauge
 */
export const roomsActive = new Gauge({
    name: 'rooms_active',
    help: 'Number of active rooms with recent messages',
    registers: [metricsRegistry],
});

/**
 * Auth events counter
 */
export const authEventsTotal = new Counter({
    name: 'auth_events_total',
    help: 'Total authentication events',
    labelNames: ['event', 'success'],
    registers: [metricsRegistry],
});

// ============================================
// Database Metrics
// ============================================

/**
 * Database query duration
 */
export const dbQueryDuration = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    registers: [metricsRegistry],
});

/**
 * Database connections
 */
export const dbConnectionsActive = new Gauge({
    name: 'db_connections_active',
    help: 'Number of active database connections',
    registers: [metricsRegistry],
});

// ============================================
// Redis Metrics
// ============================================

/**
 * Redis operation duration
 */
export const redisOperationDuration = new Histogram({
    name: 'redis_operation_duration_seconds',
    help: 'Redis operation duration in seconds',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
    registers: [metricsRegistry],
});

/**
 * Redis cache hit rate
 */
export const redisCacheHits = new Counter({
    name: 'redis_cache_hits_total',
    help: 'Total Redis cache hits',
    registers: [metricsRegistry],
});

export const redisCacheMisses = new Counter({
    name: 'redis_cache_misses_total',
    help: 'Total Redis cache misses',
    registers: [metricsRegistry],
});

// ============================================
// Helper Functions
// ============================================

/**
 * Record HTTP request metrics
 */
export const recordHttpRequest = (
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
): void => {
    const normalizedPath = normalizePath(path);
    httpRequestsTotal.inc({ method, path: normalizedPath, status_code: String(statusCode) });
    httpRequestDuration.observe(
        { method, path: normalizedPath, status_code: String(statusCode) },
        durationMs / 1000
    );
};

/**
 * Normalize path to prevent cardinality explosion
 * e.g., /api/users/123 -> /api/users/:id
 */
const normalizePath = (path: string): string => {
    return path
        .replace(/\/\d+/g, '/:id')           // Replace numeric IDs
        .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // Replace UUIDs
        .replace(/\?.*$/, '');                // Remove query params
};

/**
 * Get all metrics as Prometheus text format
 */
export const getMetrics = async (): Promise<string> => {
    return metricsRegistry.metrics();
};

/**
 * Get metrics content type
 */
export const getContentType = (): string => {
    return metricsRegistry.contentType;
};
