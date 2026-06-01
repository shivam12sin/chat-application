/**
 * Global test setup file
 * Runs before all tests
 */

import { beforeAll, afterAll, vi } from 'vitest';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Global mocks
beforeAll(() => {
    // Suppress console.log in tests (but keep errors)
    vi.spyOn(console, 'log').mockImplementation(() => { });
    vi.spyOn(console, 'info').mockImplementation(() => { });
});

afterAll(() => {
    vi.restoreAllMocks();
});
