import { z } from 'zod';

// ============================================
// AUTH SCHEMAS
// ============================================

export const loginSchema = z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(6).max(100),
});

export const registerSchema = z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email(),
    password: z.string().min(8).max(100).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase, one lowercase, and one number'),
});

// ============================================
// MESSAGE SCHEMAS
// ============================================

export const sendMessageSchema = z.object({
    roomId: z.number().int().positive(),
    content: z.string().min(1).max(10000),
    messageType: z.enum(['text', 'image', 'file']).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export const scheduleMessageSchema = z.object({
    roomId: z.number().int().positive(),
    content: z.string().min(1).max(10000),
    scheduledAt: z.string().datetime().refine(
        (date) => new Date(date) > new Date(),
        'Scheduled time must be in the future'
    ),
});

// ============================================
// ROOM SCHEMAS
// ============================================

export const createRoomSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    room_type: z.enum(['direct', 'group']),
    member_ids: z.array(z.number().int().positive()).min(1).max(100),
});

// ============================================
// BLOCK/MUTE SCHEMAS
// ============================================

export const muteSchema = z.object({
    until: z.string().datetime().optional().nullable(),
});

// ============================================
// PAGINATION SCHEMAS
// ============================================

export const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    before: z.string().uuid().optional(),
    after: z.string().uuid().optional(),
});

// ============================================
// SEARCH SCHEMAS
// ============================================

export const searchSchema = z.object({
    query: z.string().min(1).max(200),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

// ============================================
// PARAMS SCHEMAS
// ============================================

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const uuidParamSchema = z.object({
    id: z.string().uuid(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ScheduleMessageInput = z.infer<typeof scheduleMessageSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type MuteInput = z.infer<typeof muteSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
