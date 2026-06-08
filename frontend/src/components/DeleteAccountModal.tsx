import React, { useState } from 'react';
import { X, AlertTriangle, Trash2, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChromeButton from './ChromeButton';

interface DeleteAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    token: string;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose, onSuccess, token }) => {
    const [step, setStep] = useState<'confirm' | 'password'>('confirm');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    if (!isOpen) return null;

    const handleDelete = async () => {
        if (!password) {
            setError('Password is required');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/me`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ password })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete account');
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative bg-mono-surface border border-red-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-red-500/20 flex items-center justify-between bg-red-500/5">
                        <div className="flex items-center gap-2 text-red-500">
                            <AlertTriangle className="w-5 h-5" />
                            <h2 className="font-semibold">Delete Account</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-red-500/10 rounded-full transition-colors text-mono-muted hover:text-red-400"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        {step === 'confirm' ? (
                            <>
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                                    <h3 className="text-red-400 font-semibold">Warning: This action is irreversible!</h3>
                                    <p className="text-sm text-mono-text/80">
                                        Deleting your account will permanently remove:
                                    </p>
                                    <ul className="text-sm text-mono-text/70 list-disc list-inside space-y-1 ml-1">
                                        <li>Your profile and preferences</li>
                                        <li>All your messages and conversations</li>
                                        <li>Your files and media</li>
                                        <li>Your contact list</li>
                                    </ul>
                                </div>
                                <p className="text-sm text-mono-muted">
                                    Are you sure you want to proceed? This cannot be undone.
                                </p>
                                <div className="flex justify-end gap-3 pt-2">
                                    <ChromeButton
                                        variant="default"
                                        onClick={onClose}
                                        className="bg-mono-surface hover:bg-mono-bg"
                                    >
                                        Cancel
                                    </ChromeButton>
                                    <ChromeButton
                                        variant="danger"
                                        onClick={() => setStep('password')}
                                        className="bg-red-500 hover:bg-red-600 text-white border-none"
                                    >
                                        Yes, I want to delete
                                    </ChromeButton>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-mono-text">
                                    Please enter your password to confirm deletion.
                                </p>

                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full bg-mono-bg border border-mono-border rounded-xl px-4 py-3 text-mono-text focus:outline-none focus:border-red-500/50 transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-mono-muted hover:text-mono-text"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>

                                {error && (
                                    <p className="text-xs text-red-500">{error}</p>
                                )}

                                <div className="flex justify-between gap-3 pt-4">
                                    <ChromeButton
                                        variant="default"
                                        onClick={() => setStep('confirm')}
                                        disabled={isLoading}
                                        className="bg-mono-surface hover:bg-mono-bg"
                                    >
                                        Back
                                    </ChromeButton>
                                    <ChromeButton
                                        variant="danger"
                                        onClick={handleDelete}
                                        disabled={isLoading || !password}
                                        className="bg-red-600 hover:bg-red-700 text-white border-none flex-1 justify-center"
                                    >
                                        {isLoading ? (
                                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Permanently Delete
                                            </>
                                        )}
                                    </ChromeButton>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default DeleteAccountModal;
