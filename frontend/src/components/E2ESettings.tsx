/**
 * E2E Encryption Settings Component
 * 
 * Displays E2E encryption status and allows users to enable/disable E2E.
 */

import { useState } from 'react';
import { useE2E } from '../hooks/useE2E';

interface E2ESettingsProps {
    className?: string;
}

export function E2ESettings({ className = '' }: E2ESettingsProps): JSX.Element {
    const { status, isEnabled, isLoading, error, enable, disable } = useE2E();
    const [showConfirmDisable, setShowConfirmDisable] = useState(false);

    const handleEnable = async () => {
        try {
            await enable();
        } catch (err) {
            // Error is already handled by the hook
        }
    };

    const handleDisable = async () => {
        try {
            await disable();
            setShowConfirmDisable(false);
        } catch (err) {
            // Error is already handled by the hook
        }
    };

    return (
        <div className={`glass rounded-2xl p-6 ${className}`}>
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-xl ${isEnabled ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                    <svg className={`w-6 h-6 ${isEnabled ? 'text-green-400' : 'text-gray-400'}`} 
                         fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-white">End-to-End Encryption</h3>
                    <p className="text-sm text-white/60">
                        {isEnabled ? 'Enabled' : 'Not enabled'}
                    </p>
                </div>
            </div>

            {/* Description */}
            <p className="text-white/70 text-sm mb-4">
                End-to-end encryption ensures that only you and the person you're communicating with 
                can read your messages. Not even we can read them.
            </p>

            {/* Status Info */}
            {status && isEnabled && (
                <div className="glass-subtle rounded-xl p-4 mb-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-white/60">Identity Fingerprint:</span>
                        <span className="font-mono text-xs text-white/80 max-w-[200px] truncate">
                            {status.identityFingerprint || 'N/A'}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-white/60">Available Prekeys:</span>
                        <span className={`${status.needsPrekeyRefill ? 'text-yellow-400' : 'text-white/80'}`}>
                            {status.availablePrekeys}
                        </span>
                    </div>
                    {status.signedPrekeyAge && (
                        <div className="flex justify-between text-sm">
                            <span className="text-white/60">Signed Key Age:</span>
                            <span className={`${status.needsSignedPrekeyRotation ? 'text-yellow-400' : 'text-white/80'}`}>
                                {Math.floor(status.signedPrekeyAge / (24 * 60 * 60 * 1000))} days
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 mb-4">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Action Buttons */}
            {!isEnabled ? (
                <button
                    onClick={handleEnable}
                    disabled={isLoading}
                    className="w-full btn-primary py-3 rounded-xl font-medium disabled:opacity-50"
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Generating Keys...
                        </span>
                    ) : (
                        'Enable End-to-End Encryption'
                    )}
                </button>
            ) : showConfirmDisable ? (
                <div className="space-y-3">
                    <p className="text-yellow-400 text-sm">
                        ⚠️ Disabling E2E encryption will delete all your encryption keys. 
                        You will not be able to decrypt old encrypted messages.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowConfirmDisable(false)}
                            className="flex-1 btn-secondary py-2 rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDisable}
                            disabled={isLoading}
                            className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded-xl transition-colors"
                        >
                            {isLoading ? 'Disabling...' : 'Disable'}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setShowConfirmDisable(true)}
                    className="w-full glass-subtle hover:bg-white/10 py-3 rounded-xl text-white/60 transition-colors"
                >
                    Disable End-to-End Encryption
                </button>
            )}

            {/* Info Footer */}
            <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-white/40">
                    E2E encryption uses the Signal Protocol with X3DH key agreement and 
                    Double Ratchet for perfect forward secrecy.
                </p>
            </div>
        </div>
    );
}

export default E2ESettings;
