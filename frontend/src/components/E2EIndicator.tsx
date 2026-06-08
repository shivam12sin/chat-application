/**
 * E2E Encryption Indicator Component
 * 
 * Shows E2E encryption status in chat headers and provides quick access to verification.
 */

import { useState } from 'react';
import { useConversationE2E } from '../hooks/useE2E';
import { VerificationDialog } from './VerificationDialog';

interface E2EIndicatorProps {
    peerUserId: number;
    peerUsername: string;
    className?: string;
    showLabel?: boolean;
}

export function E2EIndicator({
    peerUserId,
    peerUsername,
    className = '',
    showLabel = true,
}: E2EIndicatorProps): JSX.Element | null {
    const { bothHaveE2E, selfHasE2E, peerHasE2E, isLoading } = useConversationE2E(peerUserId);
    const [showVerification, setShowVerification] = useState(false);

    if (isLoading) {
        return (
            <div className={`inline-flex items-center gap-1.5 ${className}`}>
                <div className="w-4 h-4 rounded-full bg-white/10 animate-pulse" />
            </div>
        );
    }

    // Neither has E2E - don't show anything
    if (!selfHasE2E && !peerHasE2E) {
        return null;
    }

    // Both have E2E - secure
    if (bothHaveE2E) {
        return (
            <>
                <button
                    onClick={() => setShowVerification(true)}
                    className={`inline-flex items-center gap-1.5 text-green-400 hover:text-green-300 transition-colors ${className}`}
                    title="End-to-end encrypted. Click to verify."
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {showLabel && <span className="text-xs font-medium">Encrypted</span>}
                </button>

                <VerificationDialog
                    isOpen={showVerification}
                    onClose={() => setShowVerification(false)}
                    peerUserId={peerUserId}
                    peerUsername={peerUsername}
                />
            </>
        );
    }

    // Self has E2E but peer doesn't
    if (selfHasE2E && !peerHasE2E) {
        return (
            <div 
                className={`inline-flex items-center gap-1.5 text-yellow-500 ${className}`}
                title={`${peerUsername} hasn't enabled end-to-end encryption`}
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                {showLabel && <span className="text-xs font-medium">Not Encrypted</span>}
            </div>
        );
    }

    // Peer has E2E but self doesn't
    if (!selfHasE2E && peerHasE2E) {
        return (
            <div 
                className={`inline-flex items-center gap-1.5 text-blue-400 ${className}`}
                title="Enable E2E encryption to secure this conversation"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                {showLabel && <span className="text-xs font-medium">E2E Available</span>}
            </div>
        );
    }

    return null;
}

/**
 * Compact version for message bubbles
 */
interface E2EMessageBadgeProps {
    isEncrypted: boolean;
    decryptedSuccessfully?: boolean;
    error?: string;
}

export function E2EMessageBadge({
    isEncrypted,
    decryptedSuccessfully,
    error,
}: E2EMessageBadgeProps): JSX.Element | null {
    if (!isEncrypted) {
        return null;
    }

    if (decryptedSuccessfully) {
        return (
            <span className="inline-flex items-center text-green-400/60" title="End-to-end encrypted">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            </span>
        );
    }

    if (error) {
        return (
            <span className="inline-flex items-center text-red-400/60" title={`Decryption failed: ${error}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </span>
        );
    }

    return (
        <span className="inline-flex items-center text-yellow-400/60" title="Encrypted (pending)">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
        </span>
    );
}

export default E2EIndicator;
