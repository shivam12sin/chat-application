import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, ArrowLeft, Trash2, MessageSquare, Loader2, Plus } from 'lucide-react';
import { cn } from '../utils/theme';
import socketService from '../services/socket';
import ChromeButton from './ChromeButton';
import Avatar from './Avatar';
import { useToast } from '../hooks/useToast';

interface Constellation {
    id: number;
    name: string;
    description?: string;
    message_count: number;
    created_at: string;
}

interface ConstellationMessage {
    message_id: string;
    content: string;
    message_type: string;
    message_created_at: string;
    sender_id: number;
    sender_username: string;
    sender_display_name?: string;
    room_id: number;
    room_name?: string;
    room_type: string;
    added_at: string;
}

interface ConstellationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigateToMessage?: (roomId: number, messageId: string) => void;
}

const ConstellationModal: React.FC<ConstellationModalProps> = ({
    isOpen,
    onClose,
    onNavigateToMessage,
}) => {
    const [constellations, setConstellations] = useState<Constellation[]>([]);
    const [selectedConstellation, setSelectedConstellation] = useState<Constellation | null>(null);
    const [messages, setMessages] = useState<ConstellationMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [showCreateInput, setShowCreateInput] = useState(false);
    const [newName, setNewName] = useState('');
    const { addToast } = useToast();

    const loadConstellations = useCallback(() => {
        setLoading(true);
        socketService.getConstellations((response) => {
            if (response.constellations) {
                setConstellations(response.constellations);
            }
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadConstellations();
            setSelectedConstellation(null);
            setMessages([]);
        }
    }, [isOpen, loadConstellations]);

    const selectConstellation = (constellation: Constellation) => {
        setSelectedConstellation(constellation);
        setLoadingMessages(true);
        socketService.getConstellationMessages(constellation.id, (response) => {
            if (response.messages) {
                setMessages(response.messages);
            }
            setLoadingMessages(false);
        });
    };

    const goBack = () => {
        setSelectedConstellation(null);
        setMessages([]);
        loadConstellations(); // Refresh counts
    };

    const handleCreateConstellation = () => {
        if (!newName.trim()) return;
        socketService.createConstellation(newName.trim(), undefined, (response) => {
            if (response.constellation) {
                setConstellations(prev => [response.constellation, ...prev]);
                setNewName('');
                setShowCreateInput(false);
                addToast('Constellation created!', 'success');
            }
        });
    };

    const handleDeleteConstellation = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this constellation?')) return;

        socketService.deleteConstellation(id, (response) => {
            if (response.success) {
                setConstellations(prev => prev.filter(c => c.id !== id));
                addToast('Deleted', 'success');
            }
        });
    };

    const handleRemoveMessage = (messageId: string) => {
        if (!selectedConstellation) return;
        socketService.removeFromConstellation(selectedConstellation.id, messageId, (response) => {
            if (response.success) {
                setMessages(prev => prev.filter(m => m.message_id !== messageId));
            }
        });
    };

    const handleGoToMessage = (msg: ConstellationMessage) => {
        onNavigateToMessage?.(msg.room_id, msg.message_id);
        onClose();
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
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                        'w-full max-w-md bg-mono-bg rounded-2xl shadow-2xl overflow-hidden',
                        'border border-mono-glass-border'
                    )}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-mono-glass-border bg-mono-surface/30">
                        <div className="flex items-center gap-3">
                            {selectedConstellation ? (
                                <ChromeButton variant="circle" onClick={goBack} className="p-1.5">
                                    <ArrowLeft className="w-4 h-4" />
                                </ChromeButton>
                            ) : (
                                <Star className="w-5 h-5 text-amber-400" />
                            )}
                            <h2 className="font-semibold text-mono-text">
                                {selectedConstellation?.name || 'Constellations'}
                            </h2>
                        </div>
                        <ChromeButton variant="circle" onClick={onClose} className="p-1.5">
                            <X className="w-4 h-4" />
                        </ChromeButton>
                    </div>

                    {/* Content */}
                    <div className="h-[400px] overflow-y-auto">
                        {!selectedConstellation ? (
                            // Constellation List View
                            <div className="p-3">
                                {loading ? (
                                    <div className="flex items-center justify-center h-full py-16">
                                        <Loader2 className="w-6 h-6 animate-spin text-mono-muted" />
                                    </div>
                                ) : (
                                    <>
                                        {/* Create New */}
                                        {showCreateInput ? (
                                            <div className="flex gap-2 mb-3">
                                                <input
                                                    type="text"
                                                    value={newName}
                                                    onChange={(e) => setNewName(e.target.value)}
                                                    placeholder="Name..."
                                                    autoFocus
                                                    className="flex-1 bg-mono-surface border border-mono-glass-border rounded-xl px-3 py-2 text-sm text-mono-text placeholder:text-mono-muted focus:outline-none focus:border-amber-500/50"
                                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateConstellation()}
                                                />
                                                <ChromeButton onClick={handleCreateConstellation} className="px-4 py-2 bg-amber-500 text-black text-sm font-medium">
                                                    Create
                                                </ChromeButton>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setShowCreateInput(true)}
                                                className="w-full flex items-center gap-3 p-3 mb-2 rounded-xl border border-dashed border-mono-glass-border text-mono-muted hover:text-amber-400 hover:border-amber-500/50 transition-all"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span className="text-sm">Create new constellation</span>
                                            </button>
                                        )}

                                        {/* Constellation Items */}
                                        {constellations.length === 0 ? (
                                            <div className="text-center py-12 text-mono-muted">
                                                <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                                <p className="text-sm">No constellations yet</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {constellations.map((c) => (
                                                    <div
                                                        key={c.id}
                                                        onClick={() => selectConstellation(c)}
                                                        className="group flex items-center justify-between p-3 rounded-xl bg-mono-surface/50 hover:bg-mono-surface cursor-pointer transition-colors border border-transparent hover:border-mono-glass-border"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <Star className="w-4 h-4 text-amber-400" />
                                                            <div>
                                                                <p className="text-sm font-medium text-mono-text">{c.name}</p>
                                                                <p className="text-xs text-mono-muted">{c.message_count} messages</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => handleDeleteConstellation(c.id, e)}
                                                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition-all"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : (
                            // Messages View
                            <div className="p-3">
                                {loadingMessages ? (
                                    <div className="flex items-center justify-center py-16">
                                        <Loader2 className="w-6 h-6 animate-spin text-mono-muted" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center py-12 text-mono-muted">
                                        <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                        <p className="text-sm">No messages in this constellation</p>
                                        <p className="text-xs mt-1">Add messages from chat using the ⋮ menu</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {messages.map((msg) => (
                                            <div
                                                key={msg.message_id}
                                                className="group p-3 rounded-xl bg-mono-surface/50 hover:bg-mono-surface transition-colors"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <Avatar name={msg.sender_username} size="sm" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-mono-text">
                                                                {msg.sender_display_name || msg.sender_username}
                                                            </span>
                                                            <span className="text-xs text-mono-muted">
                                                                {new Date(msg.message_created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-mono-text/80 mt-1 break-words line-clamp-2">
                                                            {msg.content}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleGoToMessage(msg)}
                                                            className="p-1.5 hover:bg-mono-glass-highlight rounded-lg"
                                                            title="Go to message"
                                                        >
                                                            <MessageSquare className="w-3.5 h-3.5 text-mono-muted" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleRemoveMessage(msg.message_id)}
                                                            className="p-1.5 hover:bg-red-500/20 rounded-lg"
                                                            title="Remove"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ConstellationModal;
