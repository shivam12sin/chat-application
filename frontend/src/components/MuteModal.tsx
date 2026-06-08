import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, VolumeX, Clock } from 'lucide-react';
import ChromeButton from './ChromeButton';
import { cn } from '../utils/theme';

interface MuteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onMute: (until?: Date) => void;
    targetName: string;
    isLoading?: boolean;
}

const MUTE_OPTIONS = [
    { label: '1 hour', hours: 1 },
    { label: '8 hours', hours: 8 },
    { label: '1 week', hours: 168 },
    { label: 'Forever', hours: null },
];

const MuteModal: React.FC<MuteModalProps> = ({
    isOpen,
    onClose,
    onMute,
    targetName,
    isLoading = false
}) => {
    const [selectedOption, setSelectedOption] = useState<number | null>(null);

    const handleMute = () => {
        const option = MUTE_OPTIONS[selectedOption!];
        if (option.hours === null) {
            onMute(undefined); // Forever
        } else {
            const until = new Date();
            until.setHours(until.getHours() + option.hours);
            onMute(until);
        }
    };

    if (!isOpen) return null;

    const modalContent = (
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 10000 }}
        >
            {/* Backdrop */}
            <div
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <div
                className={cn(
                    "relative w-full max-w-sm overflow-hidden",
                    "bg-mono-bg/95 backdrop-blur-xl border border-mono-glass-border rounded-2xl",
                    "shadow-2xl shadow-black/50"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                        <VolumeX className="w-5 h-5 text-accent-cyan" />
                        Mute {targetName}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Options */}
                <div className="p-4 space-y-2">
                    {MUTE_OPTIONS.map((option, index) => (
                        <button
                            key={option.label}
                            onClick={() => setSelectedOption(index)}
                            className={cn(
                                "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all",
                                selectedOption === index
                                    ? "bg-accent-cyan/20 border border-accent-cyan/50 text-accent-cyan"
                                    : "bg-white/5 border border-transparent hover:bg-white/10 text-white/80"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Clock className="w-4 h-4 opacity-60" />
                                <span className="font-medium">{option.label}</span>
                            </div>
                            {selectedOption === index && (
                                <div className="w-2 h-2 rounded-full bg-accent-cyan" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 flex gap-3">
                    <ChromeButton
                        type="button"
                        onClick={onClose}
                        className="flex-1 opacity-70 hover:opacity-100 bg-white/5 hover:bg-white/10"
                    >
                        Cancel
                    </ChromeButton>
                    <ChromeButton
                        type="button"
                        onClick={handleMute}
                        disabled={selectedOption === null || isLoading}
                        className="flex-1 bg-accent-cyan/20 hover:bg-accent-cyan/30 text-accent-cyan border-accent-cyan/50 disabled:opacity-50"
                    >
                        {isLoading ? 'Muting...' : 'Mute'}
                    </ChromeButton>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default MuteModal;
