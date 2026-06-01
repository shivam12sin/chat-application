/**
 * Unit tests for Call Handler
 * Tests: basic call handler functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import callHandler from '../../src/socket/handlers/callHandler';

// Mock dependencies
vi.mock('../../src/config/database', () => ({
    default: {
        query: vi.fn(),
    },
}));

vi.mock('../../src/repositories/CallRepository', () => ({
    CallRepository: {
        createCall: vi.fn(),
        updateCallStatus: vi.fn(),
        endCall: vi.fn(),
    },
}));

describe('Call Handler', () => {
    let mockSocket: any;
    let mockIo: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSocket = {
            id: 'socket-caller',
            userId: 1,
            username: 'caller',
            emit: vi.fn(),
            to: vi.fn().mockReturnThis(),
            join: vi.fn(),
            leave: vi.fn(),
        };

        mockIo = {
            to: vi.fn().mockReturnThis(),
            emit: vi.fn(),
        };

        // Initialize handler
        callHandler.initialize(mockIo);
    });

    describe('handleInitiateCall', () => {
        it('should not throw when initiating a call', async () => {
            await expect(
                callHandler.handleInitiateCall(mockSocket, {
                    calleeId: 2,
                    callType: 'voice',
                })
            ).resolves.not.toThrow();
        });
    });

    describe('handleAcceptCall', () => {
        it('should not throw when accepting a call', async () => {
            await expect(
                callHandler.handleAcceptCall(mockSocket, {
                    callId: 100,
                    callerId: 1,
                })
            ).resolves.not.toThrow();
        });
    });

    describe('handleRejectCall', () => {
        it('should not throw when rejecting a call', async () => {
            await expect(
                callHandler.handleRejectCall(mockSocket, {
                    callId: 100,
                    callerId: 1,
                })
            ).resolves.not.toThrow();
        });
    });

    describe('handleEndCall', () => {
        it('should not throw when ending a call', async () => {
            await expect(
                callHandler.handleEndCall(mockSocket, {
                    callId: 100,
                    otherUserId: 2,
                    duration: 120,
                })
            ).resolves.not.toThrow();
        });
    });

    describe('handleSignal', () => {
        it('should relay WebRTC signaling data without throwing', () => {
            // handleSignal returns void, not a Promise
            expect(() => {
                callHandler.handleSignal(mockSocket, {
                    targetUserId: 2,
                    type: 'offer',
                    payload: { sdp: 'test-sdp' },
                });
            }).not.toThrow();
        });
    });
});
