import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../utils/theme';
import ChromeButton from './ChromeButton';

interface ChatLockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUnlock: (password: string) => Promise<boolean>;
    roomName: string;
}

const ChatLockModal: React.FC<ChatLockModalProps> = ({
    isOpen,
    onClose,
    onUnlock,
    roomName,
}) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attempts, setAttempts] = useState(0);
    const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const MAX_ATTEMPTS = 3;
    const COOLDOWN_SECONDS = 30;

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
        // Reset state when modal opens
        if (isOpen) {
            setPassword('');
            setError(null);
        }
    }, [isOpen]);

    // Cooldown timer
    useEffect(() => {
        if (!cooldownEnd) return;

        const interval = setInterval(() => {
            const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
            if (remaining <= 0) {
                setCooldownEnd(null);
                setCooldownRemaining(0);
                setAttempts(0);
            } else {
                setCooldownRemaining(remaining);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [cooldownEnd]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim() || isVerifying || cooldownEnd) return;

        setIsVerifying(true);
        setError(null);

        try {
            const success = await onUnlock(password);
            if (success) {
                setPassword('');
                setAttempts(0);
                onClose();
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);

                if (newAttempts >= MAX_ATTEMPTS) {
                    setCooldownEnd(Date.now() + COOLDOWN_SECONDS * 1000);
                    setCooldownRemaining(COOLDOWN_SECONDS);
                    setError(`Too many attempts. Try again in ${COOLDOWN_SECONDS} seconds.`);
                } else {
                    setError(`Incorrect password. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
                }
                setPassword('');
            }
        } catch {
            setError('Failed to verify password. Please try again.');
        } finally {
            setIsVerifying(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                        'w-full max-w-sm bg-mono-bg rounded-2xl shadow-2xl overflow-hidden',
                        'border border-mono-glass-border p-6'
                    )}
                >
                    {/* Header */}
                    <div className="flex flex-col items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <Lock className="w-8 h-8 text-amber-400" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-lg font-semibold text-mono-text">Locked Chat</h2>
                            <p className="text-sm text-mono-muted mt-1 truncate max-w-[250px]">{roomName}</p>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit}>
                        <div className="relative mb-4">
                            <input
                                ref={inputRef}
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                disabled={isVerifying || !!cooldownEnd}
                                className={cn(
                                    'w-full px-4 py-3 pr-12 rounded-xl',
                                    'bg-mono-surface border border-mono-glass-border',
                                    'text-mono-text placeholder:text-mono-muted',
                                    'focus:outline-none focus:border-mono-glass-highlight',
                                    'disabled:opacity-50 disabled:cursor-not-allowed',
                                    error && 'border-red-500/50'
                                )}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-mono-muted hover:text-mono-text"
                            >
                                {showPassword ? (
                                    <EyeOff className="w-5 h-5" />
                                ) : (
                                    <Eye className="w-5 h-5" />
                                )}
                            </button>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm mb-4 p-3 bg-red-500/10 rounded-lg">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Cooldown Display */}
                        {cooldownEnd && (
                            <div className="text-center text-mono-muted text-sm mb-4">
                                Try again in <span className="text-amber-400 font-medium">{cooldownRemaining}s</span>
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <ChromeButton
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3"
                            >
                                Cancel
                            </ChromeButton>
                            <ChromeButton
                                type="submit"
                                disabled={!password.trim() || isVerifying || !!cooldownEnd}
                                className={cn(
                                    "flex-1 py-3",
                                    "bg-amber-500 text-black font-medium",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                            >
                                {isVerifying ? (
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                ) : (
                                    'Unlock'
                                )}
                            </ChromeButton>
                        </div>
                    </form>

                    {/* Hint */}
                    <p className="text-xs text-mono-muted text-center mt-4">
                        Use your account password to unlock this chat
                    </p>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ChatLockModal;
