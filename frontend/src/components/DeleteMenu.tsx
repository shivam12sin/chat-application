import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, User, X } from 'lucide-react';
import { cn } from '../utils/theme';

interface DeleteMenuProps {
    isOpen: boolean;
    position: { x: number; y: number };
    isSender: boolean;
    onDeleteForMe: () => void;
    onDeleteForEveryone: () => void;
    onCancel: () => void;
}

const DeleteMenu: React.FC<DeleteMenuProps> = ({
    isOpen,
    position,
    isSender,
    onDeleteForMe,
    onDeleteForEveryone,
    onCancel
}) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className={cn(
                    "fixed z-[100] min-w-[180px]",
                    "bg-mono-surface-1/95 backdrop-blur-md",
                    "border border-mono-glass-border rounded-lg",
                    "shadow-xl overflow-hidden"
                )}
                style={{
                    left: position.x,
                    top: position.y
                }}
            >
                {/* Delete for Me */}
                <button
                    onClick={onDeleteForMe}
                    className={cn(
                        "w-full flex items-center gap-3 px-4 py-3",
                        "hover:bg-mono-surface-2 transition-colors",
                        "text-mono-text text-sm"
                    )}
                >
                    <User className="w-4 h-4 text-mono-muted" />
                    <span>Delete for Me</span>
                </button>

                {/* Delete for Everyone (only for sender) */}
                {isSender && (
                    <button
                        onClick={onDeleteForEveryone}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3",
                            "hover:bg-mono-surface-2 transition-colors",
                            "text-red-400 text-sm"
                        )}
                    >
                        <Users className="w-4 h-4" />
                        <span>Delete for Everyone</span>
                    </button>
                )}

                {/* Divider */}
                <div className="border-t border-mono-glass-border" />

                {/* Cancel */}
                <button
                    onClick={onCancel}
                    className={cn(
                        "w-full flex items-center gap-3 px-4 py-3",
                        "hover:bg-mono-surface-2 transition-colors",
                        "text-mono-muted text-sm"
                    )}
                >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                </button>
            </motion.div>

            {/* Backdrop to close menu */}
            <div
                className="fixed inset-0 z-[99]"
                onClick={onCancel}
            />
        </AnimatePresence>
    );
};

export default DeleteMenu;
