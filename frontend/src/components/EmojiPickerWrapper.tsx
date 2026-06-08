import React, { useRef, useEffect } from 'react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { cn } from '../utils/theme';
import '../styles/emoji-picker-dark.css';

interface EmojiPickerWrapperProps {
    isOpen: boolean;
    onClose: () => void;
    onEmojiSelect: (emoji: string) => void;
    position?: 'top' | 'bottom';
    align?: 'left' | 'right';
    className?: string;
}

const EmojiPickerWrapper: React.FC<EmojiPickerWrapperProps> = ({
    isOpen,
    onClose,
    onEmojiSelect,
    position = 'top',
    align = 'left',
    className
}) => {
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
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

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        onEmojiSelect(emojiData.emoji);
        onClose();
    };

    const menuVariants: Variants = {
        hidden: {
            opacity: 0,
            scale: 0.95,
            y: position === 'top' ? 10 : -10,
            transition: { duration: 0.15, ease: "easeOut" }
        },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 30
            }
        },
        exit: {
            opacity: 0,
            scale: 0.95,
            y: position === 'top' ? 10 : -10,
            transition: { duration: 0.15, ease: "easeIn" }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={pickerRef}
                    variants={menuVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className={cn(
                        'absolute z-50',
                        position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
                        align === 'left' ? 'left-0' : 'right-0',
                        className
                    )}
                    style={{ transformOrigin: `${align} ${position === 'top' ? 'bottom' : 'top'}` }}
                >
                    <div className="rounded-2xl overflow-hidden border border-mono-glass-border shadow-2xl">
                        <EmojiPicker
                            theme={Theme.DARK}
                            onEmojiClick={handleEmojiClick}
                            width={260}
                            height={300}
                            searchPlaceHolder="Search emojis..."
                            previewConfig={{ showPreview: false }}
                            skinTonesDisabled
                            lazyLoadEmojis
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default EmojiPickerWrapper;
