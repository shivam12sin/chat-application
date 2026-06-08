import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2, X } from 'lucide-react';
import { cn } from '../utils/theme';

interface UndoToastProps {
    isVisible: boolean;
    duration?: number; // in ms, default 7000
    onUndo: () => void;
    onExpire: () => void;
    onDismiss: () => void;
}

const UndoToast: React.FC<UndoToastProps> = ({
    isVisible,
    duration = 7000,
    onUndo,
    onExpire,
    onDismiss
}) => {
    const [remaining, setRemaining] = useState(duration);

    // Countdown timer
    useEffect(() => {
        if (!isVisible) {
            setRemaining(duration);
            return;
        }

        const interval = setInterval(() => {
            setRemaining(prev => {
                if (prev <= 100) {
                    clearInterval(interval);
                    onExpire();
                    return 0;
                }
                return prev - 100;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [isVisible, duration, onExpire]);

    // Progress percentage
    const progress = (remaining / duration) * 100;

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                    "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]",
                    "bg-mono-surface-1/95 backdrop-blur-md",
                    "border border-mono-glass-border rounded-xl",
                    "shadow-xl overflow-hidden",
                    "min-w-[280px]"
                )}
            >
                {/* Progress bar */}
                <div className="absolute top-0 left-0 h-1 bg-mono-surface-3">
                    <motion.div
                        className="h-full bg-amber-500"
                        style={{ width: `${progress}%` }}
                        transition={{ duration: 0.1 }}
                    />
                </div>

                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <span className="text-mono-text text-sm">
                            Message deleted
                        </span>
                        <span className="text-mono-muted text-xs font-mono">
                            {Math.ceil(remaining / 1000)}s
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onUndo}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md",
                                "bg-amber-500/20 text-amber-400",
                                "hover:bg-amber-500/30 transition-colors",
                                "text-sm font-medium"
                            )}
                        >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>Undo</span>
                        </button>

                        <button
                            onClick={onDismiss}
                            className={cn(
                                "p-1.5 rounded-md",
                                "hover:bg-mono-surface-2 transition-colors"
                            )}
                        >
                            <X className="w-4 h-4 text-mono-muted" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default UndoToast;
