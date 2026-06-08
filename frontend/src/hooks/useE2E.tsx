/**
 * E2E Encryption React Hook
 * 
 * Provides a simple interface for components to interact with E2E encryption.
 */

import { useState, useEffect, useCallback } from 'react';
import { e2eCryptoService, type E2EStatus, type E2EConfig } from '../crypto/E2ECryptoService';
import { getConversationE2EStatus, getVerificationInfo } from '../services/e2eMessageService';

// ============================================
// MAIN E2E HOOK
// ============================================

interface UseE2EOptions {
    autoInitialize?: boolean;
}

interface UseE2EReturn {
    // State
    status: E2EStatus | null;
    isInitialized: boolean;
    isEnabled: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    initialize: (config: E2EConfig) => Promise<void>;
    enable: () => Promise<void>;
    disable: () => Promise<void>;
    refreshStatus: () => Promise<void>;
}

export function useE2E(_options: UseE2EOptions = {}): UseE2EReturn {
    // Note: autoInitialize is handled by useE2EInit hook

    const [status, setStatus] = useState<E2EStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshStatus = useCallback(async () => {
        try {
            const newStatus = await e2eCryptoService.getStatus();
            setStatus(newStatus);
        } catch (err) {
            console.error('Failed to get E2E status:', err);
        }
    }, []);

    const initialize = useCallback(async (config: E2EConfig) => {
        setIsLoading(true);
        setError(null);

        try {
            await e2eCryptoService.initialize(config);
            await refreshStatus();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to initialize E2E';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [refreshStatus]);

    const enable = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            await e2eCryptoService.enableE2E();
            await refreshStatus();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to enable E2E';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [refreshStatus]);

    const disable = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            await e2eCryptoService.resetE2E();
            await refreshStatus();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to disable E2E';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [refreshStatus]);

    return {
        status,
        isInitialized: status?.initialized ?? false,
        isEnabled: status?.enabled ?? false,
        isLoading,
        error,
        initialize,
        enable,
        disable,
        refreshStatus,
    };
}

// ============================================
// CONVERSATION E2E STATUS HOOK
// ============================================

interface UseConversationE2EReturn {
    bothHaveE2E: boolean;
    selfHasE2E: boolean;
    peerHasE2E: boolean;
    safetyNumber: string | null;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

export function useConversationE2E(peerUserId: number | null): UseConversationE2EReturn {
    const [bothHaveE2E, setBothHaveE2E] = useState(false);
    const [selfHasE2E, setSelfHasE2E] = useState(false);
    const [peerHasE2E, setPeerHasE2E] = useState(false);
    const [safetyNumber, setSafetyNumber] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!peerUserId) {
            setBothHaveE2E(false);
            setSelfHasE2E(false);
            setPeerHasE2E(false);
            setSafetyNumber(null);
            return;
        }

        setIsLoading(true);
        try {
            const status = await getConversationE2EStatus(peerUserId);
            setBothHaveE2E(status.bothHaveE2E);
            setSelfHasE2E(status.selfHasE2E);
            setPeerHasE2E(status.peerHasE2E);
            setSafetyNumber(status.safetyNumber ?? null);
        } catch (err) {
            console.error('Failed to get conversation E2E status:', err);
        } finally {
            setIsLoading(false);
        }
    }, [peerUserId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        bothHaveE2E,
        selfHasE2E,
        peerHasE2E,
        safetyNumber,
        isLoading,
        refresh,
    };
}

// ============================================
// VERIFICATION HOOK
// ============================================

interface UseVerificationReturn {
    ownFingerprint: string | null;
    peerFingerprint: string | null;
    safetyNumber: string | null;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

export function useVerification(peerUserId: number | null): UseVerificationReturn {
    const [ownFingerprint, setOwnFingerprint] = useState<string | null>(null);
    const [peerFingerprint, setPeerFingerprint] = useState<string | null>(null);
    const [safetyNumber, setSafetyNumber] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!peerUserId) {
            setOwnFingerprint(null);
            setPeerFingerprint(null);
            setSafetyNumber(null);
            return;
        }

        setIsLoading(true);
        try {
            const info = await getVerificationInfo(peerUserId);
            setOwnFingerprint(info.ownFingerprint);
            setPeerFingerprint(info.peerFingerprint);
            setSafetyNumber(info.safetyNumber);
        } catch (err) {
            console.error('Failed to get verification info:', err);
        } finally {
            setIsLoading(false);
        }
    }, [peerUserId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        ownFingerprint,
        peerFingerprint,
        safetyNumber,
        isLoading,
        refresh,
    };
}

// ============================================
// E2E STATUS BADGE COMPONENT
// ============================================

interface E2EStatusBadgeProps {
    peerUserId: number;
    className?: string;
}

export function E2EStatusBadge({ peerUserId, className = '' }: E2EStatusBadgeProps): JSX.Element | null {
    const { bothHaveE2E, selfHasE2E, peerHasE2E, isLoading } = useConversationE2E(peerUserId);

    if (isLoading) {
        return null;
    }

    if (bothHaveE2E) {
        return (
            <div className={`inline-flex items-center gap-1 text-green-500 ${className}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-xs">E2E</span>
            </div>
        );
    }

    if (selfHasE2E && !peerHasE2E) {
        return (
            <div className={`inline-flex items-center gap-1 text-yellow-500 ${className}`} title="Peer has not enabled E2E encryption">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                <span className="text-xs">Not E2E</span>
            </div>
        );
    }

    return null;
}

// ============================================
// VERIFICATION DIALOG HOOK
// ============================================

interface VerificationDialogState {
    isOpen: boolean;
    peerUserId: number | null;
    peerUsername: string | null;
}

export function useVerificationDialog() {
    const [state, setState] = useState<VerificationDialogState>({
        isOpen: false,
        peerUserId: null,
        peerUsername: null,
    });

    const open = useCallback((peerUserId: number, peerUsername: string) => {
        setState({ isOpen: true, peerUserId, peerUsername });
    }, []);

    const close = useCallback(() => {
        setState({ isOpen: false, peerUserId: null, peerUsername: null });
    }, []);

    return {
        ...state,
        open,
        close,
    };
}
