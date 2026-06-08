/**
 * E2E Verification Dialog Component
 * 
 * Displays safety numbers for verifying encryption with a contact.
 */

import { useEffect, useState } from 'react';
import { useVerification } from '../hooks/useE2E';

interface VerificationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    peerUserId: number;
    peerUsername: string;
}

export function VerificationDialog({
    isOpen,
    onClose,
    peerUserId,
    peerUsername,
}: VerificationDialogProps): JSX.Element | null {
    const { ownFingerprint, safetyNumber, isLoading, refresh } = useVerification(peerUserId);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            refresh();
        }
    }, [isOpen, refresh]);

    const handleCopy = async () => {
        if (safetyNumber) {
            await navigator.clipboard.writeText(safetyNumber);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative glass rounded-2xl p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-green-500/20">
                            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Verify Encryption</h3>
                            <p className="text-sm text-white/60">with {peerUsername}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                    >
                        <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <svg className="animate-spin h-8 w-8 text-accent-primary" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                ) : safetyNumber ? (
                    <div className="space-y-4">
                        <p className="text-white/70 text-sm">
                            Compare this safety number with {peerUsername} to verify that your messages 
                            are end-to-end encrypted. The number should match on both devices.
                        </p>

                        {/* Safety Number Display */}
                        <div className="glass-subtle rounded-xl p-4">
                            <p className="text-xs text-white/40 mb-2">Safety Number</p>
                            <div className="font-mono text-sm text-white/90 leading-relaxed tracking-wider break-all">
                                {formatSafetyNumber(safetyNumber)}
                            </div>
                        </div>

                        {/* Your Fingerprint */}
                        {ownFingerprint && (
                            <div className="glass-subtle rounded-xl p-4">
                                <p className="text-xs text-white/40 mb-2">Your Identity Fingerprint</p>
                                <div className="font-mono text-xs text-white/60 leading-relaxed tracking-wider break-all">
                                    {formatSafetyNumber(ownFingerprint)}
                                </div>
                            </div>
                        )}

                        {/* QR Code Placeholder */}
                        <div className="glass-subtle rounded-xl p-4 text-center">
                            <div className="w-32 h-32 mx-auto bg-white/10 rounded-lg flex items-center justify-center mb-2">
                                <svg className="w-12 h-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                            </div>
                            <p className="text-xs text-white/40">
                                Scan with {peerUsername}'s device to verify
                            </p>
                        </div>

                        {/* Copy Button */}
                        <button
                            onClick={handleCopy}
                            className="w-full btn-secondary py-3 rounded-xl flex items-center justify-center gap-2"
                        >
                            {copied ? (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                    </svg>
                                    Copy Safety Number
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="p-3 rounded-xl bg-yellow-500/20 inline-flex mb-4">
                            <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <p className="text-white/70">
                            {peerUsername} hasn't enabled end-to-end encryption yet.
                        </p>
                        <p className="text-white/50 text-sm mt-2">
                            Ask them to enable E2E encryption to verify your conversation.
                        </p>
                    </div>
                )}

                {/* Info Footer */}
                <div className="mt-6 pt-4 border-t border-white/10">
                    <p className="text-xs text-white/40 text-center">
                        If the safety numbers don't match, your messages may not be secure.
                        Consider meeting in person to verify.
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * Format safety number for display
 */
function formatSafetyNumber(number: string): string {
    // Split into groups of 5 for readability
    const clean = number.replace(/\s/g, '');
    const groups: string[] = [];
    for (let i = 0; i < clean.length; i += 5) {
        groups.push(clean.slice(i, i + 5));
    }
    // Display in rows of 4 groups
    const rows: string[] = [];
    for (let i = 0; i < groups.length; i += 4) {
        rows.push(groups.slice(i, i + 4).join(' '));
    }
    return rows.join('\n');
}

export default VerificationDialog;
