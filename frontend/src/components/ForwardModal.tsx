import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/theme';
import { X, Forward, Search, Check } from 'lucide-react';
import ChromeButton from './ChromeButton';

interface Room {
    id: number;
    name: string;
    avatar?: string;
    room_type: 'direct' | 'group';
}

interface ForwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onForward: (roomIds: number[]) => void;
    messagePreview: string;
    rooms: Room[];
}

const ForwardModal: React.FC<ForwardModalProps> = ({
    isOpen,
    onClose,
    onForward,
    messagePreview,
    rooms,
}) => {
    const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedRooms([]);
            setSearchQuery('');
        }
    }, [isOpen]);

    const filteredRooms = rooms.filter(room =>
        room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleRoom = (roomId: number) => {
        setSelectedRooms(prev =>
            prev.includes(roomId)
                ? prev.filter(id => id !== roomId)
                : [...prev, roomId]
        );
    };

    const handleForward = () => {
        if (selectedRooms.length > 0) {
            onForward(selectedRooms);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                    className={cn(
                        'bg-mono-bg/95 backdrop-blur-xl rounded-2xl w-full max-w-md',
                        'border border-mono-glass-border shadow-2xl overflow-hidden'
                    )}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-mono-glass-border">
                        <div className="flex items-center gap-3">
                            <Forward className="w-5 h-5 text-blue-400" />
                            <h2 className="text-lg font-semibold text-mono-text">Forward Message</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-mono-surface rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-mono-muted" />
                        </button>
                    </div>

                    {/* Message Preview */}
                    <div className="px-4 py-3 bg-mono-surface/50 border-b border-mono-glass-border">
                        <p className="text-xs text-mono-muted mb-1">Message:</p>
                        <p className="text-sm text-mono-text line-clamp-2">{messagePreview}</p>
                    </div>

                    {/* Search */}
                    <div className="p-4 border-b border-mono-glass-border">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mono-muted" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search chats..."
                                className={cn(
                                    'w-full pl-10 pr-4 py-2 rounded-xl',
                                    'bg-mono-surface border border-mono-glass-border',
                                    'text-mono-text placeholder-mono-muted text-sm',
                                    'focus:outline-none focus:border-blue-500'
                                )}
                            />
                        </div>
                    </div>

                    {/* Room List */}
                    <div className="max-h-[300px] overflow-y-auto">
                        {filteredRooms.length === 0 ? (
                            <div className="p-8 text-center text-mono-muted text-sm">
                                No chats found
                            </div>
                        ) : (
                            filteredRooms.map(room => (
                                <button
                                    key={room.id}
                                    onClick={() => toggleRoom(room.id)}
                                    className={cn(
                                        'w-full flex items-center gap-3 p-3 hover:bg-mono-surface transition-colors',
                                        selectedRooms.includes(room.id) && 'bg-blue-500/10'
                                    )}
                                >
                                    {/* Avatar */}
                                    <div className={cn(
                                        'w-10 h-10 rounded-full flex items-center justify-center',
                                        'bg-gradient-to-br from-blue-500 to-purple-500 text-white font-medium'
                                    )}>
                                        {room.avatar ? (
                                            <img src={room.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            room.name.charAt(0).toUpperCase()
                                        )}
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-medium text-mono-text">{room.name}</p>
                                        <p className="text-xs text-mono-muted">
                                            {room.room_type === 'group' ? 'Space' : 'Direct'}
                                        </p>
                                    </div>

                                    {/* Checkbox */}
                                    <div className={cn(
                                        'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                                        selectedRooms.includes(room.id)
                                            ? 'bg-blue-500 border-blue-500'
                                            : 'border-mono-muted'
                                    )}>
                                        {selectedRooms.includes(room.id) && (
                                            <Check className="w-3 h-3 text-white" />
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-mono-glass-border flex justify-between items-center">
                        <span className="text-sm text-mono-muted">
                            {selectedRooms.length} selected
                        </span>
                        <ChromeButton
                            onClick={handleForward}
                            disabled={selectedRooms.length === 0}
                            className={cn(
                                'px-6 py-2',
                                selectedRooms.length === 0 && 'opacity-50'
                            )}
                        >
                            Forward
                        </ChromeButton>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ForwardModal;
