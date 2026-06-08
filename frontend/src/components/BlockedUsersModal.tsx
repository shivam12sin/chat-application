import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Ban, UserCheck, Loader2 } from 'lucide-react';
import ChromeButton from './ChromeButton';
import Avatar from './Avatar';
import { cn } from '../utils/theme';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface BlockedUser {
    id: number;
    blocked_id: number;
    blocked_username: string;
    created_at: string;
}

interface BlockedUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    onUnblock?: (userId: number) => void;
}

const BlockedUsersModal: React.FC<BlockedUsersModalProps> = ({
    isOpen,
    onClose,
    token,
    onUnblock
}) => {
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [unblockingId, setUnblockingId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchBlockedUsers();
        }
    }, [isOpen]);

    const fetchBlockedUsers = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/blocked`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBlockedUsers(response.data);
        } catch (error) {
            console.error('Failed to fetch blocked users:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnblock = async (userId: number) => {
        setUnblockingId(userId);
        try {
            await axios.post(`${API_URL}/users/${userId}/unblock`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBlockedUsers(prev => prev.filter(u => u.blocked_id !== userId));
            onUnblock?.(userId);
        } catch (error) {
            console.error('Failed to unblock user:', error);
        } finally {
            setUnblockingId(null);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={cn(
                            "relative w-full max-w-md max-h-[80vh] flex flex-col",
                            "bg-glass-panel border border-glass-border/30 rounded-2xl",
                            "shadow-2xl shadow-black/50 overflow-hidden"
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/5 flex-shrink-0">
                            <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                <Ban className="w-5 h-5 text-red-400" />
                                Blocked Users
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-2 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 min-h-[200px]">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-6 h-6 text-mono-muted animate-spin" />
                                </div>
                            ) : blockedUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-mono-muted">
                                    <UserCheck className="w-12 h-12 mb-3 opacity-50" />
                                    <p className="text-sm">No blocked users</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {blockedUsers.map(user => (
                                        <div
                                            key={user.blocked_id}
                                            className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar name={user.blocked_username} size="sm" />
                                                <div>
                                                    <p className="text-sm font-medium text-white">
                                                        {user.blocked_username}
                                                    </p>
                                                    <p className="text-xs text-mono-muted">
                                                        Blocked {new Date(user.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChromeButton
                                                onClick={() => handleUnblock(user.blocked_id)}
                                                disabled={unblockingId === user.blocked_id}
                                                className="text-green-400 hover:text-green-300 text-xs px-3 py-1"
                                            >
                                                {unblockingId === user.blocked_id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    'Unblock'
                                                )}
                                            </ChromeButton>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/5 flex-shrink-0">
                            <ChromeButton
                                onClick={onClose}
                                className="w-full bg-white/5 hover:bg-white/10"
                            >
                                Close
                            </ChromeButton>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default BlockedUsersModal;
