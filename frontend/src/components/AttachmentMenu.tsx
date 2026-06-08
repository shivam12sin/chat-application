import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../utils/theme';
import { Image, FileText, BarChart2, MapPin, FileImage, Music, Clock, Plus } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import ChromeButton from './ChromeButton';

interface AttachmentMenuProps {
    onSelect: (type: 'image' | 'video' | 'file' | 'poll' | 'location' | 'gif' | 'music' | 'schedule') => void;
    className?: string;
}

const AttachmentMenu: React.FC<AttachmentMenuProps> = ({ onSelect, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const options = [
        { type: 'image', label: 'Photos & Videos', icon: <Image className="w-4 h-4" /> },
        { type: 'file', label: 'Document', icon: <FileText className="w-4 h-4" /> },
        { type: 'poll', label: 'Poll', icon: <BarChart2 className="w-4 h-4" /> },
        { type: 'location', label: 'Location', icon: <MapPin className="w-4 h-4" /> },
        { type: 'music', label: 'Orbit', icon: <Music className="w-4 h-4" /> },
        { type: 'gif', label: 'GIF', icon: <FileImage className="w-4 h-4" /> },
        { type: 'schedule', label: 'Schedule', icon: <Clock className="w-4 h-4" /> },
    ] as const;

    // Animation Variants (Matches SettingsMenu)
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
                staggerChildren: 0.05
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
        hidden: { opacity: 0, x: -10, filter: "blur(4px)" },
        visible: {
            opacity: 1,
            x: 0,
            filter: "blur(0px)",
            transition: { duration: 0.2 }
        }
    };

    return (
        <div className={cn('relative', className)} ref={menuRef}>
            <ChromeButton
                onClick={() => setIsOpen(!isOpen)}
                variant="circle"
                className={cn(
                    'flex-shrink-0 min-w-[36px] min-h-[36px]',
                    isOpen && 'text-mono-text bg-mono-surface'
                )}
                aria-label="Attach"
            >
                <Plus className="w-5 h-5" />
            </ChromeButton>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={menuVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className={cn(
                            'absolute bottom-full left-0 mb-3 w-56',
                            'bg-mono-bg/95 backdrop-blur-glass border border-mono-glass-border',
                            'rounded-2xl shadow-2xl overflow-hidden',
                            'z-50 p-1'
                        )}
                        style={{ transformOrigin: "bottom left" }}
                    >
                        {options.map((option) => (
                            <motion.button
                                key={option.type}
                                variants={itemVariants}
                                onClick={() => {
                                    onSelect(option.type);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2.5',
                                    'text-sm text-mono-text hover:bg-mono-surface',
                                    'rounded-xl transition-colors text-left group'
                                )}
                            >
                                <span className="text-mono-muted group-hover:text-mono-text transition-colors">
                                    {option.icon}
                                </span>
                                <span className="font-medium">{option.label}</span>
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AttachmentMenu;
