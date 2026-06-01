/**
 * Mock database for unit tests
 * Provides in-memory storage for testing repositories without DB connection
 */

import { vi } from 'vitest';

// In-memory storage
const storage: Record<string, unknown[]> = {};

// Mock query function
export const mockQuery = vi.fn().mockImplementation(async (text: string, params?: unknown[]) => {
    // Simple mock that tracks calls
    return { rows: [], rowCount: 0 };
});

// Create mock database
export const createMockDatabase = () => ({
    query: mockQuery,
    healthCheck: vi.fn().mockResolvedValue(true),
});

// Reset all mocks between tests
export const resetMocks = () => {
    mockQuery.mockClear();
    Object.keys(storage).forEach(key => delete storage[key]);
};

// Helper to set up expected query results
export const setQueryResult = (result: { rows: unknown[]; rowCount: number }) => {
    mockQuery.mockResolvedValueOnce(result);
};

// Helper to make query throw
export const setQueryError = (error: Error) => {
    mockQuery.mockRejectedValueOnce(error);
};

export default {
    query: mockQuery,
    healthCheck: vi.fn().mockResolvedValue(true),
};
