import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, VolumeX, Volume2, Loader2, Users, MessageSquare } from 'lucide-react';
import ChromeButton from './ChromeButton';
import Avatar from './Avatar';
import { cn } from '../utils/theme';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface MutedItem {
    id: number;
    muted_user_id?: number;
    muted_room_id?: number;
    muted_username?: string;
    muted_room_name?: string;
    mute_until?: string;
    created_at: string;
}

interface MutedListModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    onUnmute?: (type: 'user' | 'room', id: number) => void;
}

const MutedListModal: React.FC<MutedListModalProps> = ({
    isOpen,
    onClose,
    token,
    onUnmute
}) => {
    const [mutedItems, setMutedItems] = useState<MutedItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [unmutingId, setUnmutingId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchMutedList();
        }
    }, [isOpen]);

    const fetchMutedList = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/muted`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMutedItems(response.data);
        } catch (error) {
            console.error('Failed to fetch muted list:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnmute = async (item: MutedItem) => {
        const id = item.muted_user_id || item.muted_room_id;
        if (!id) return;

        setUnmutingId(item.id);
        try {
            const endpoint = item.muted_user_id
                ? `${API_URL}/users/${id}/unmute`
                : `${API_URL}/rooms/${id}/unmute`;

            await axios.post(endpoint, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setMutedItems(prev => prev.filter(i => i.id !== item.id));
            onUnmute?.(item.muted_user_id ? 'user' : 'room', id);
        } catch (error) {
            console.error('Failed to unmute:', error);
        } finally {
            setUnmutingId(null);
        }
    };

    const formatMuteExpiry = (until?: string) => {
        if (!until) return 'Permanently muted';
        const date = new Date(until);
        if (date <= new Date()) return 'Expired';
        return `Until ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
                                <VolumeX className="w-5 h-5 text-orange-400" />
                                Muted Items
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
                            ) : mutedItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-mono-muted">
                                    <Volume2 className="w-12 h-12 mb-3 opacity-50" />
                                    <p className="text-sm">No muted users or rooms</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {mutedItems.map(item => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
                                        >
                                            <div className="flex items-center gap-3">
                                                {item.muted_user_id ? (
                                                    <Avatar name={item.muted_username || 'User'} size="sm" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center">
                                                        <MessageSquare className="w-4 h-4 text-accent-purple" />
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-medium text-white">
                                                            {item.muted_username || item.muted_room_name}
                                                        </p>
                                                        {item.muted_user_id ? (
                                                            <Users className="w-3 h-3 text-mono-muted" />
                                                        ) : (
                                                            <MessageSquare className="w-3 h-3 text-mono-muted" />
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-mono-muted">
                                                        {formatMuteExpiry(item.mute_until)}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChromeButton
                                                onClick={() => handleUnmute(item)}
                                                disabled={unmutingId === item.id}
                                                className="text-green-400 hover:text-green-300 text-xs px-3 py-1"
                                            >
                                                {unmutingId === item.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    'Unmute'
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

export default MutedListModal;
