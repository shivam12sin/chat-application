import React, { useState, useRef, useEffect } from 'react';
import { Settings, LogOut, User, Ban, Smartphone, Star, Shield, CheckCircle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { cn } from '../utils/theme';
import ChromeButton from './ChromeButton';
import Avatar from './Avatar';
import BlockedUsersModal from './BlockedUsersModal';
import DeviceManagement from './DeviceManagement';
import MyDetailsModal from './MyDetailsModal';
import TwoFactorSetupModal from './TwoFactorSetupModal';
import DeleteAccountModal from './DeleteAccountModal';

interface SettingsMenuProps {
    user?: {
        name: string;
        username?: string;
        avatar?: string;
        email?: string;
    };
    token?: string;
    onLogout: () => void;
    onConstellations?: () => void;
    onUpdateProfile?: (updates: any) => void;
    className?: string;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ user, token, onLogout, onConstellations, onUpdateProfile, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isBlockedUsersOpen, setIsBlockedUsersOpen] = useState(false);
    const [isDevicesOpen, setIsDevicesOpen] = useState(false);
    const [isMyDetailsOpen, setIsMyDetailsOpen] = useState(false);
    const [isTwoFactorSetupOpen, setIsTwoFactorSetupOpen] = useState(false);
    const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Fetch 2FA status
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const authToken = token || localStorage.getItem('token');
                if (!authToken) return;
                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/2fa/status`, {
                    headers: { Authorization: `Bearer ${authToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setIs2FAEnabled(data.enabled);
                }
            } catch (err) {
                console.error('Failed to fetch 2FA status:', err);
            }
        };
        fetchStatus();
    }, [token, isTwoFactorSetupOpen]);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Animation Variants
    const menuVariants: Variants = {
        hidden: {
            opacity: 0,
            scale: 0.98,
            transition: {
                duration: 0.15,
                ease: "easeOut" as const
            }
        },
        visible: {
            opacity: 1,
            scale: 1,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 34,
                mass: 1,
                staggerChildren: 0.08,
                delayChildren: 0.05
            }
        },
        exit: {
            opacity: 0,
            scale: 0.98,
            transition: {
                duration: 0.15,
                ease: "easeIn" as const
            }
        }
    };

    const itemVariants: Variants = {
        hidden: {
            opacity: 0,
            y: 8,
            filter: "blur(5px)"
        },
        visible: {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            transition: {
                duration: 0.3,
                ease: [0.2, 0.65, 0.3, 0.9] as const
            }
        }
    };

    return (
        <>
            <div className={cn("relative", className)} ref={menuRef}>
                <ChromeButton
                    variant="circle"
                    className={cn(
                        "p-2 min-h-[36px] min-w-[36px] flex items-center justify-center",
                        isOpen ? "text-mono-text bg-mono-surface" : "text-mono-muted"
                    )}
                    title="Settings"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <Settings className="w-5 h-5" />
                </ChromeButton>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            variants={menuVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className={cn(
                                "absolute bottom-full right-0 mb-3 w-64",
                                "bg-mono-bg/95 backdrop-blur-xl border border-mono-glass-border",
                                "rounded-2xl shadow-2xl overflow-hidden",
                                "z-50",
                                "divide-y divide-mono-glass-border"
                            )}
                            style={{ transformOrigin: "bottom right" }}
                        >
                            {/* User Info Header */}
                            <motion.div variants={itemVariants} className="p-4 flex items-center gap-3 bg-mono-surface/30">
                                <Avatar src={user?.avatar} name={user?.name} size="md" />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-mono-text truncate">
                                        {user?.name || 'User'}
                                    </p>
                                </div>
                            </motion.div>

                            {/* Menu Items */}
                            <div className="p-1 space-y-1">
                                <motion.button
                                    variants={itemVariants}
                                    onClick={() => {
                                        setIsOpen(false);
                                        onConstellations?.();
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 rounded-xl transition-colors text-left"
                                >
                                    <Star className="w-4 h-4" />
                                    <span>Constellations</span>
                                </motion.button>

                                <motion.button
                                    variants={itemVariants}
                                    onClick={() => {
                                        setIsOpen(false);
                                        setIsMyDetailsOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-mono-text hover:bg-mono-surface rounded-xl transition-colors text-left"
                                >
                                    <User className="w-4 h-4 text-mono-muted" />
                                    <span>My Details</span>
                                </motion.button>

                                <motion.button
                                    variants={itemVariants}
                                    onClick={() => {
                                        setIsOpen(false);
                                        setIsBlockedUsersOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-mono-text hover:bg-mono-surface rounded-xl transition-colors text-left"
                                >
                                    <Ban className="w-4 h-4 text-mono-muted" />
                                    <span>Blocked Users</span>
                                </motion.button>

                                <motion.button
                                    variants={itemVariants}
                                    onClick={() => {
                                        setIsOpen(false);
                                        setIsDevicesOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-mono-text hover:bg-mono-surface rounded-xl transition-colors text-left"
                                >
                                    <Smartphone className="w-4 h-4 text-mono-muted" />
                                    <span>Linked Devices</span>
                                </motion.button>

                                <motion.button
                                    variants={itemVariants}
                                    onClick={() => {
                                        setIsOpen(false);
                                        setIsTwoFactorSetupOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-mono-text hover:bg-mono-surface rounded-xl transition-colors text-left"
                                >
                                    <Shield className="w-4 h-4 text-mono-muted" />
                                    <span className="flex-1">Two-Factor Auth</span>
                                    {is2FAEnabled && (
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                    )}
                                </motion.button>

                                <div className="h-px bg-mono-border/50 mx-3 my-1" />

                                <motion.button
                                    variants={itemVariants}
                                    onClick={() => {
                                        setIsOpen(false);
                                        onLogout();
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-mono-text hover:bg-mono-surface/50 rounded-xl transition-colors text-left"
                                >
                                    <LogOut className="w-4 h-4 text-mono-muted" />
                                    <span>Log Out</span>
                                </motion.button>

                                <motion.button
                                    variants={itemVariants}
                                    onClick={() => {
                                        setIsOpen(false);
                                        setIsDeleteAccountOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-500/80 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors text-left group"
                                >
                                    <Trash2 className="w-4 h-4 text-red-500/60 group-hover:text-red-500" />
                                    <span>Delete Account</span>
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Blocked Users Modal */}
            <BlockedUsersModal
                isOpen={isBlockedUsersOpen}
                onClose={() => setIsBlockedUsersOpen(false)}
                token={token || localStorage.getItem('token') || ''}
            />

            {/* Device Management Modal */}
            {isDevicesOpen && (
                <DeviceManagement onClose={() => setIsDevicesOpen(false)} />
            )}

            {/* My Details Modal */}
            {user && (
                <MyDetailsModal
                    isOpen={isMyDetailsOpen}
                    onClose={() => setIsMyDetailsOpen(false)}
                    user={{
                        name: user.name,
                        username: user.username || '',
                        email: user.email,
                        avatar: user.avatar
                    }}
                    token={token || localStorage.getItem('token') || ''}
                    onUpdateProfile={onUpdateProfile || (() => { })}
                />
            )}
            {/* 2FA Setup Modal */}
            <TwoFactorSetupModal
                isOpen={isTwoFactorSetupOpen}
                onClose={() => setIsTwoFactorSetupOpen(false)}
                onSuccess={() => {
                    // Could refresh user profile if needed
                }}
            />

            {/* Delete Account Modal */}
            <DeleteAccountModal
                isOpen={isDeleteAccountOpen}
                onClose={() => setIsDeleteAccountOpen(false)}
                onSuccess={() => {
                    setIsDeleteAccountOpen(false);
                    onLogout(); // Log out immediately after deletion
                }}
                token={token || localStorage.getItem('token') || ''}
            />
        </>
    );
};

export default SettingsMenu;
