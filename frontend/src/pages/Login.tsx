import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../hooks/useToast';

import ToastContainer from '../components/Toast';
import ParticleBackground from '../components/ParticleBackground';
import AetherLogo from '../components/AetherLogo';
import ChromeButton from '../components/ChromeButton';

const Login: React.FC = () => {
    // Force rebuild
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // 2FA State
    const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
    const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'email' | null>(null);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [tempToken, setTempToken] = useState<string | null>(null);

    const { toasts, dismissToast, error: errorToast, success } = useToast();
    const navigate = useNavigate();

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: username, password })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Login failed');

            if (data.requires2FA) {
                setRequiresTwoFactor(true);
                setTwoFactorMethod(data.method);
                setTempToken(data.tempToken);
                if (data.message) success(data.message); // e.g. "Code sent to email"
                return;
            }

            // Normal login success
            localStorage.setItem('token', data.accessToken);
            if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.user));
            success('Login successful!');
            navigate('/');
        } catch (err: any) {
            console.error(err);
            errorToast(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempToken || !twoFactorCode) return;

        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/auth/2fa/login/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tempToken, code: twoFactorCode })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Verification failed');

            // Success
            localStorage.setItem('token', data.accessToken);
            if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.user));
            success('Login successful!');
            navigate('/');
        } catch (err: any) {
            console.error(err);
            errorToast(err.message || 'Verification failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen text-mono-text flex items-center justify-center p-4 relative overflow-hidden">
            <div className="w-full max-w-sm relative z-10">
                <div className="text-center mb-12">
                    <AetherLogo size="lg" />
                </div>

                {!requiresTwoFactor ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="input-glass"
                            placeholder="Email or Username"
                            required
                        />
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-glass pr-12"
                                placeholder="Password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-mono-muted hover:text-mono-text transition-colors p-1"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <ChromeButton
                            type="submit"
                            disabled={isLoading}
                            className="w-full min-h-[44px]"
                        >
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </ChromeButton>
                    </form>
                ) : (
                    <form onSubmit={handleVerify2FA} className="space-y-6">
                        <div className="text-center space-y-2">
                            <h3 className="text-lg font-semibold text-mono-text">
                                {twoFactorMethod === 'totp' ? 'Authenticator Code' : 'Email Verification'}
                            </h3>
                            <p className="text-sm text-mono-muted">
                                {twoFactorMethod === 'totp'
                                    ? 'Enter the code from your authenticator app'
                                    : 'Enter the verification code sent to your email'}
                            </p>
                        </div>

                        <input
                            type="text"
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="input-glass text-center text-2xl tracking-[0.5em] font-mono h-14"
                            placeholder="000000"
                            autoFocus
                            required
                        />

                        <ChromeButton
                            type="submit"
                            disabled={isLoading}
                            className="w-full min-h-[44px]"
                        >
                            {isLoading ? 'Verifying...' : 'Verify'}
                        </ChromeButton>

                        <button
                            type="button"
                            onClick={() => {
                                setRequiresTwoFactor(false);
                                setTwoFactorCode('');
                                setTempToken(null);
                            }}
                            className="w-full text-sm text-mono-muted hover:text-mono-text py-2 transition-colors"
                        >
                            Back to Login
                        </button>
                    </form>
                )}

                {!requiresTwoFactor && (
                    <div className="mt-6 text-center">
                        <Link
                            to="/register"
                            className="text-mono-muted hover:text-mono-text text-sm transition-colors"
                        >
                            Need an account?
                        </Link>
                    </div>
                )}
            </div>
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
            <div className="fixed inset-0 pointer-events-none z-0">
                <ParticleBackground />
            </div>
        </div>
    );
};

export default Login;
