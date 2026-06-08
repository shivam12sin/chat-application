import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Plus, Check, Loader2 } from 'lucide-react';
import { cn } from '../utils/theme';
import socketService from '../services/socket';

interface Constellation {
    id: number;
    name: string;
    description?: string;
    message_count: number;
}

interface AddToConstellationMenuProps {
    isOpen: boolean;
    onClose: () => void;
    messageId: string;
    roomId: number;
    position: { x: number; y: number };
    onSuccess?: () => void;
}

const AddToConstellationMenu: React.FC<AddToConstellationMenuProps> = ({
    isOpen,
    onClose,
    messageId,
    roomId,
    position,
    onSuccess,
}) => {
    const [constellations, setConstellations] = useState<Constellation[]>([]);
    const [messageConstellations, setMessageConstellations] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, messageId]);

    const loadData = () => {
        setLoading(true);
        // Load user's constellations
        socketService.getConstellations((response) => {
            if (response.constellations) {
                setConstellations(response.constellations);
            }
            // Load which constellations this message is already in
            socketService.getConstellationsForMessage(messageId, (msgResponse) => {
                if (msgResponse.constellationIds) {
                    setMessageConstellations(msgResponse.constellationIds);
                }
                setLoading(false);
            });
        });
    };

    const handleCreateConstellation = () => {
        if (!newName.trim()) return;
        setCreating(true);
        socketService.createConstellation(newName.trim(), undefined, (response) => {
            setCreating(false);
            if (response.constellation) {
                // Add message to the new constellation
                socketService.addToConstellation(response.constellation.id, messageId, roomId, () => {
                    onSuccess?.();
                    onClose();
                });
            }
        });
    };

    const handleToggleConstellation = (constellationId: number) => {
        const isInConstellation = messageConstellations.includes(constellationId);

        if (isInConstellation) {
            socketService.removeFromConstellation(constellationId, messageId, (response) => {
                if (response.success) {
                    setMessageConstellations(prev => prev.filter(id => id !== constellationId));
                }
            });
        } else {
            socketService.addToConstellation(constellationId, messageId, roomId, (response) => {
                if (response.success) {
                    setMessageConstellations(prev => [...prev, constellationId]);
                    onSuccess?.();
                }
            });
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed z-[100] min-w-[220px] max-w-[280px] bg-mono-bg border border-mono-glass-border rounded-xl shadow-2xl overflow-hidden"
                style={{ left: position.x, top: position.y }}
            >
                {/* Header */}
                <div className="flex items-center gap-2 p-3 border-b border-mono-glass-border">
                    <Star className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-mono-text">Add to Constellation</span>
                </div>

                {/* Content */}
                <div className="max-h-[250px] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center p-6">
                            <Loader2 className="w-5 h-5 animate-spin text-mono-muted" />
                        </div>
                    ) : (
                        <div className="p-2">
                            {/* Existing constellations */}
                            {constellations.map((constellation) => {
                                const isSelected = messageConstellations.includes(constellation.id);
                                return (
                                    <button
                                        key={constellation.id}
                                        onClick={() => handleToggleConstellation(constellation.id)}
                                        className={cn(
                                            'w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors',
                                            isSelected
                                                ? 'bg-amber-500/20 text-amber-300'
                                                : 'hover:bg-mono-surface text-mono-text'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Star className={cn('w-4 h-4', isSelected ? 'fill-amber-400' : '')} />
                                            <span className="text-sm truncate">{constellation.name}</span>
                                        </div>
                                        {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                                    </button>
                                );
                            })}

                            {constellations.length === 0 && !showCreate && (
                                <p className="text-xs text-mono-muted text-center py-4">
                                    No constellations yet
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Create New */}
                <div className="border-t border-mono-glass-border p-2">
                    {showCreate ? (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Constellation name..."
                                autoFocus
                                className="flex-1 bg-mono-surface border border-mono-glass-border rounded-lg px-3 py-1.5 text-sm text-mono-text placeholder:text-mono-muted focus:outline-none focus:border-mono-glass-highlight"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateConstellation()}
                            />
                            <button
                                onClick={handleCreateConstellation}
                                disabled={!newName.trim() || creating}
                                className="px-3 py-1.5 bg-amber-500 text-black rounded-lg text-sm font-medium disabled:opacity-50"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="w-full flex items-center gap-2 p-2 rounded-lg text-mono-muted hover:text-mono-text hover:bg-mono-surface transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm">Create new constellation</span>
                        </button>
                    )}
                </div>
            </motion.div>

            {/* Backdrop */}
            <div className="fixed inset-0 z-[99]" onClick={onClose} />
        </AnimatePresence>
    );
};

export default AddToConstellationMenu;
