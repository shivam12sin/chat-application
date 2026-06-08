import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pin, Trash2 } from 'lucide-react';
import { cn } from '../utils/theme';
import ChromeButton from './ChromeButton';
import Avatar from './Avatar';
import socketService from '../services/socket';
import { useToast } from '../hooks/useToast';

interface PinnedMessage {
    id: string;
    content: string;
    sender_username: string;
    sender_avatar?: string;
    created_at: string;
}

interface PinnedMessagesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    roomId: number;
    roomType: 'direct' | 'group';
}

const PinnedMessagesDrawer: React.FC<PinnedMessagesDrawerProps> = ({
    isOpen,
    onClose,
    roomId,
    roomType,
}) => {
    const [messages, setMessages] = useState<PinnedMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        if (isOpen && roomId) {
            loadPinnedMessages();
        }
    }, [isOpen, roomId]);

    // Listen for pin/unpin events
    useEffect(() => {
        const onPinned = (data: { messageId: string; roomId: number }) => {
            if (data.roomId === roomId) {
                loadPinnedMessages();
            }
        };

        const onUnpinned = (data: { messageId: string; roomId: number }) => {
            if (data.roomId === roomId) {
                setMessages(prev => prev.filter(m => m.id !== data.messageId));
            }
        };

        socketService.on('message:pinned', onPinned);
        socketService.on('message:unpinned', onUnpinned);

        return () => {
            socketService.off('message:pinned', onPinned);
            socketService.off('message:unpinned', onUnpinned);
        };
    }, [roomId]);

    const loadPinnedMessages = () => {
        setIsLoading(true);
        socketService.getPinnedMessages(roomId, (response) => {
            setIsLoading(false);
            if (response.messages) {
                setMessages(response.messages);
            }
        });
    };

    const handleUnpin = (messageId: string) => {
        socketService.unpinMessage(messageId, roomId, (response) => {
            if (response.error) {
                addToast(response.error, 'error');
            } else {
                addToast('Message unpinned', 'success');
                setMessages(prev => prev.filter(m => m.id !== messageId));
            }
        });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={cn(
                    'fixed right-0 top-0 bottom-0 w-80 z-50',
                    'bg-mono-bg border-l border-mono-glass-border',
                    'flex flex-col shadow-2xl'
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-mono-glass-border">
                    <div className="flex items-center gap-2">
                        <Pin className="w-5 h-5 text-amber-400" />
                        <h2 className="text-lg font-semibold text-mono-text">
                            {roomType === 'group' ? 'Space Memory' : 'Pinned Messages'}
                        </h2>
                    </div>
                    <ChromeButton variant="circle" onClick={onClose} className="p-2">
                        <X className="w-4 h-4" />
                    </ChromeButton>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="w-6 h-6 border-2 border-mono-muted border-t-white rounded-full animate-spin" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center py-12">
                            <Pin className="w-12 h-12 text-mono-muted/30 mx-auto mb-4" />
                            <p className="text-mono-muted text-sm">No pinned messages yet</p>
                            <p className="text-mono-muted/70 text-xs mt-1">
                                Pin important messages to save them here
                            </p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    'p-3 rounded-lg',
                                    'bg-mono-surface/50 border border-mono-glass-border',
                                    'hover:bg-mono-surface/70 transition-colors group'
                                )}
                            >
                                <div className="flex items-start gap-2 mb-2">
                                    <Avatar name={msg.sender_username} src={msg.sender_avatar} size="sm" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-mono-text">{msg.sender_username}</span>
                                            <span className="text-[10px] text-mono-muted">{formatDate(msg.created_at)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleUnpin(msg.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-mono-muted hover:text-red-400 transition-all"
                                        title="Unpin"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <p className="text-sm text-mono-text/80 line-clamp-3">{msg.content}</p>
                            </motion.div>
                        ))
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PinnedMessagesDrawer;
