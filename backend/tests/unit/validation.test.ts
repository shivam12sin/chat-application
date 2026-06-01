/**
 * Unit tests for validation schemas
 */

import { describe, it, expect } from 'vitest';
import {
    loginSchema,
    registerSchema,
    sendMessageSchema,
    createRoomSchema,
    muteSchema,
    paginationSchema,
    searchSchema,
    idParamSchema,
} from '../../src/schemas/validation';

describe('Validation Schemas', () => {
    describe('loginSchema', () => {
        it('should validate correct login data', () => {
            const result = loginSchema.safeParse({
                username: 'testuser',
                password: 'password123',
            });
            expect(result.success).toBe(true);
        });

        it('should reject username too short', () => {
            const result = loginSchema.safeParse({
                username: 'ab',
                password: 'password123',
            });
            expect(result.success).toBe(false);
        });

        it('should reject password too short', () => {
            const result = loginSchema.safeParse({
                username: 'testuser',
                password: '12345',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('registerSchema', () => {
        it('should validate correct registration data', () => {
            const result = registerSchema.safeParse({
                username: 'newuser',
                email: 'test@example.com',
                password: 'Password1',
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid email', () => {
            const result = registerSchema.safeParse({
                username: 'newuser',
                email: 'not-an-email',
                password: 'Password1',
            });
            expect(result.success).toBe(false);
        });

        it('should reject weak password', () => {
            const result = registerSchema.safeParse({
                username: 'newuser',
                email: 'test@example.com',
                password: 'weakpass', // No uppercase/number
            });
            expect(result.success).toBe(false);
        });

        it('should reject username with special characters', () => {
            const result = registerSchema.safeParse({
                username: 'user@name!',
                email: 'test@example.com',
                password: 'Password1',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('sendMessageSchema', () => {
        it('should validate correct message data', () => {
            const result = sendMessageSchema.safeParse({
                roomId: 1,
                content: 'Hello, world!',
            });
            expect(result.success).toBe(true);
        });

        it('should reject empty content', () => {
            const result = sendMessageSchema.safeParse({
                roomId: 1,
                content: '',
            });
            expect(result.success).toBe(false);
        });

        it('should reject negative roomId', () => {
            const result = sendMessageSchema.safeParse({
                roomId: -1,
                content: 'Hello',
            });
            expect(result.success).toBe(false);
        });

        it('should accept optional messageType', () => {
            const result = sendMessageSchema.safeParse({
                roomId: 1,
                content: 'Hello',
                messageType: 'image',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('createRoomSchema', () => {
        it('should validate direct room', () => {
            const result = createRoomSchema.safeParse({
                room_type: 'direct',
                member_ids: [1, 2],
            });
            expect(result.success).toBe(true);
        });

        it('should validate group room with name', () => {
            const result = createRoomSchema.safeParse({
                name: 'My Group',
                room_type: 'group',
                member_ids: [1, 2, 3],
            });
            expect(result.success).toBe(true);
        });

        it('should reject empty member_ids', () => {
            const result = createRoomSchema.safeParse({
                room_type: 'group',
                member_ids: [],
            });
            expect(result.success).toBe(false);
        });
    });

    describe('paginationSchema', () => {
        it('should use defaults when no values provided', () => {
            const result = paginationSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(50);
            }
        });

        it('should coerce string limit to number', () => {
            const result = paginationSchema.safeParse({ limit: '25' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBe(25);
            }
        });

        it('should reject limit over max', () => {
            const result = paginationSchema.safeParse({ limit: 200 });
            expect(result.success).toBe(false);
        });
    });

    describe('searchSchema', () => {
        it('should validate search query', () => {
            const result = searchSchema.safeParse({ query: 'hello world' });
            expect(result.success).toBe(true);
        });

        it('should reject empty query', () => {
            const result = searchSchema.safeParse({ query: '' });
            expect(result.success).toBe(false);
        });
    });

    describe('idParamSchema', () => {
        it('should coerce string id to number', () => {
            const result = idParamSchema.safeParse({ id: '123' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe(123);
            }
        });

        it('should reject non-positive id', () => {
            const result = idParamSchema.safeParse({ id: '0' });
            expect(result.success).toBe(false);
        });
    });
});
