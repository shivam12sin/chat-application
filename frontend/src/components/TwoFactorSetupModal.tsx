import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Smartphone, Mail, X, Check, Loader2, ArrowRight, Copy } from 'lucide-react';
import ChromeButton from './ChromeButton';

interface TwoFactorSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type Step = 'select' | 'setup_totp' | 'setup_email' | 'success';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState<Step>('select');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);
    const [verifyCode, setVerifyCode] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setStep('select');
            setVerifyCode('');
            setError(null);
        }
    }, [isOpen]);

    const getToken = () => localStorage.getItem('token');

    const handleInit = async (method: 'totp' | 'email') => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/auth/2fa/setup/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ method })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Setup failed');

            if (method === 'totp') {
                setQrCode(data.qrCode);
                setSecret(data.secret);
                setStep('setup_totp');
            } else {
                setEmail(data.email);
                setStep('setup_email');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async (method: 'totp' | 'email') => {
        if (!verifyCode) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/auth/2fa/setup/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    code: verifyCode,
                    method,
                    secret: method === 'totp' ? secret : undefined
                })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Verification failed');

            setStep('success');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-mono-bg border border-mono-glass-border rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-mono-glass-border">
                            <div className="flex items-center gap-3">
                                <Shield className="w-5 h-5 text-mono-text" />
                                <h2 className="text-lg font-semibold text-mono-text">Two-Factor Authentication</h2>
                            </div>
                            <button onClick={onClose} className="p-2 text-mono-muted hover:text-mono-text rounded-full hover:bg-mono-surface transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {error && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
                                    {error}
                                </div>
                            )}

                            {step === 'select' && (
                                <div className="space-y-4">
                                    <p className="text-mono-muted text-sm mb-4">Select a verification method to secure your account:</p>

                                    <button
                                        onClick={() => handleInit('totp')}
                                        className="w-full flex items-center p-4 bg-mono-surface border border-mono-glass-border hover:border-mono-text transition-colors rounded-xl text-left"
                                        disabled={isLoading}
                                    >
                                        <div className="p-3 bg-mono-bg rounded-full mr-4">
                                            <Smartphone className="w-6 h-6 text-mono-text" />
                                        </div>
                                        <div>
                                            <h3 className="text-mono-text font-medium">Authenticator App</h3>
                                            <p className="text-mono-muted text-xs">Use Google Authenticator, Authy, etc.</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-mono-muted ml-auto" />
                                    </button>

                                    <button
                                        onClick={() => handleInit('email')}
                                        className="w-full flex items-center p-4 bg-mono-surface border border-mono-glass-border hover:border-mono-text transition-colors rounded-xl text-left"
                                        disabled={isLoading}
                                    >
                                        <div className="p-3 bg-mono-bg rounded-full mr-4">
                                            <Mail className="w-6 h-6 text-mono-text" />
                                        </div>
                                        <div>
                                            <h3 className="text-mono-text font-medium">Email Verification</h3>
                                            <p className="text-mono-muted text-xs">Receive codes via email</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-mono-muted ml-auto" />
                                    </button>
                                </div>
                            )}

                            {step === 'setup_totp' && (
                                <div className="space-y-6">
                                    <div className="text-center space-y-2">
                                        <h3 className="text-mono-text font-medium">Scan QR Code</h3>
                                        <p className="text-mono-muted text-xs">Open your authenticator app and scan this code</p>
                                    </div>

                                    <div className="flex justify-center p-4 bg-white rounded-xl w-fit mx-auto">
                                        {qrCode && <img src={qrCode} alt="QR Code" className="w-48 h-48" />}
                                    </div>

                                    <div className="flex items-center gap-2 p-3 bg-mono-surface rounded-lg text-xs text-mono-muted break-all justify-between group cursor-pointer" onClick={() => copyToClipboard(secret || '')}>
                                        <span className="font-mono">{secret}</span>
                                        <Copy className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-mono-muted uppercase">Enter Code</label>
                                        <input
                                            type="text"
                                            value={verifyCode}
                                            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="000 000"
                                            className="w-full bg-mono-surface border border-mono-glass-border text-mono-text px-4 py-3 rounded-xl focus:outline-none focus:border-mono-text text-center text-xl tracking-widest font-mono placeholder:text-mono-muted/30"
                                            autoFocus
                                        />
                                    </div>

                                    <ChromeButton onClick={() => handleVerify('totp')} disabled={isLoading || verifyCode.length !== 6} className="w-full">
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Enable'}
                                    </ChromeButton>
                                    <button onClick={() => setStep('select')} className="w-full text-xs text-mono-muted hover:text-mono-text py-2">Back</button>
                                </div>
                            )}

                            {step === 'setup_email' && (
                                <div className="space-y-6">
                                    <div className="text-center space-y-2">
                                        <div className="w-12 h-12 bg-mono-surface rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Mail className="w-6 h-6 text-mono-text" />
                                        </div>
                                        <h3 className="text-mono-text font-medium">Check your Email</h3>
                                        <p className="text-mono-muted text-xs">We sent a verification code to <strong>{email}</strong></p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-mono-muted uppercase">Enter Code</label>
                                        <input
                                            type="text"
                                            value={verifyCode}
                                            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="000 000"
                                            className="w-full bg-mono-surface border border-mono-glass-border text-mono-text px-4 py-3 rounded-xl focus:outline-none focus:border-mono-text text-center text-xl tracking-widest font-mono placeholder:text-mono-muted/30"
                                            autoFocus
                                        />
                                    </div>

                                    <ChromeButton onClick={() => handleVerify('email')} disabled={isLoading || verifyCode.length !== 6} className="w-full">
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Enable'}
                                    </ChromeButton>
                                    <button onClick={() => setStep('select')} className="w-full text-xs text-mono-muted hover:text-mono-text py-2">Back</button>
                                </div>
                            )}

                            {step === 'success' && (
                                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                    <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                                        <Check className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-bold text-mono-text">Success!</h3>
                                    <p className="text-mono-muted text-center text-sm">Two-Factor Authentication has been enabled.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default TwoFactorSetupModal;
