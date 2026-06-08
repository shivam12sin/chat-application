import React, { useRef, useEffect, useState } from 'react';
import { cn } from '../utils/theme';
import { Reply, Star, Pin, Forward, Copy, CheckSquare, User, Users } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

interface MessageOptionsMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onReply?: () => void;
    onConstellation?: () => void;
    onPin?: () => void;
    onForward?: () => void;
    onCopy?: () => void;
    onDeleteForMe?: () => void;
    onDeleteForEveryone?: () => void;
    onSelect?: () => void;
    isOwn?: boolean;
    className?: string;
}

const MessageOptionsMenu: React.FC<MessageOptionsMenuProps> = ({
    isOpen,
    onClose,
    onReply,
    onConstellation,
    onPin,
    onForward,
    onCopy,
    onDeleteForMe,
    onDeleteForEveryone,
    onSelect,
    isOwn = false,
    className
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [showBelow, setShowBelow] = useState(false);

    // Determine if menu should appear above or below
    useEffect(() => {
        if (isOpen && menuRef.current) {
            const parent = menuRef.current.parentElement;
            if (parent) {
                const rect = parent.getBoundingClientRect();
                const menuHeight = 320; // Approximate menu height
                const spaceAbove = rect.top;
                setShowBelow(spaceAbove < menuHeight);
            }
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const options = [
        { key: 'reply', label: 'Reply', icon: <Reply className="w-4 h-4" />, action: onReply },
        { key: 'constellation', label: 'Add to Constellation', icon: <Star className="w-4 h-4" />, action: onConstellation },
        { key: 'pin', label: 'Pin', icon: <Pin className="w-4 h-4" />, action: onPin },
        { key: 'forward', label: 'Forward', icon: <Forward className="w-4 h-4" />, action: onForward },
        { key: 'copy', label: 'Copy', icon: <Copy className="w-4 h-4" />, action: onCopy },
        { key: 'divider1', divider: true },
        { key: 'deleteForMe', label: 'Delete for Me', icon: <User className="w-4 h-4" />, action: onDeleteForMe, danger: true },
        ...(isOwn ? [{ key: 'deleteForEveryone', label: 'Delete for Everyone', icon: <Users className="w-4 h-4" />, action: onDeleteForEveryone, danger: true }] : []),
        { key: 'divider2', divider: true },
        { key: 'select', label: 'Select messages', icon: <CheckSquare className="w-4 h-4" />, action: onSelect },
    ];

    // Animation Variants (Matches AttachmentMenu/SettingsMenu)
    const menuVariants: Variants = {
        hidden: {
            opacity: 0,
            scale: 0.95,
            y: 10,
            transition: { duration: 0.15, ease: "easeOut" }
        },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 30,
                staggerChildren: 0.04
            }
        },
        exit: {
            opacity: 0,
            scale: 0.95,
            y: 10,
            transition: { duration: 0.15, ease: "easeIn" }
        }
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, x: -8, filter: "blur(4px)" },
        visible: {
            opacity: 1,
            x: 0,
            filter: "blur(0px)",
            transition: { duration: 0.2 }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={menuRef}
                    variants={menuVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className={cn(
                        'absolute z-50 w-48',
                        'bg-mono-bg/95 backdrop-blur-glass border border-mono-glass-border',
                        'rounded-2xl shadow-2xl overflow-hidden',
                        'p-1',
                        isOwn ? 'right-0' : 'left-0',
                        showBelow ? 'top-full mt-2' : 'bottom-full mb-2',
                        className
                    )}
                    style={{
                        transformOrigin: showBelow
                            ? (isOwn ? "top right" : "top left")
                            : (isOwn ? "bottom right" : "bottom left")
                    }}
                >
                    {options.map((option) => {
                        if (option.divider) {
                            return (
                                <motion.div
                                    key={option.key}
                                    variants={itemVariants}
                                    className="my-1 border-t border-mono-glass-border"
                                />
                            );
                        }

                        return (
                            <motion.button
                                key={option.key}
                                variants={itemVariants}
                                onClick={() => {
                                    option.action?.();
                                    onClose();
                                }}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2',
                                    'text-sm hover:bg-mono-surface',
                                    'rounded-xl transition-colors text-left group',
                                    option.danger
                                        ? 'text-red-400 hover:text-red-300'
                                        : 'text-mono-text'
                                )}
                            >
                                <span className={cn(
                                    'transition-colors',
                                    option.danger
                                        ? 'text-red-400/70 group-hover:text-red-300'
                                        : 'text-mono-muted group-hover:text-mono-text'
                                )}>
                                    {option.icon}
                                </span>
                                <span className="font-medium">{option.label}</span>
                            </motion.button>
                        );
                    })}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default MessageOptionsMenu;
