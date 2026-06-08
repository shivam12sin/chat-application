import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock } from 'lucide-react';
import DatePicker from 'react-datepicker';
import ChromeButton from './ChromeButton';
import { cn } from '../utils/theme';

import 'react-datepicker/dist/react-datepicker.css';
import '../styles/datepicker-dark.css';

interface ScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSchedule: (date: Date) => void;
    isLoading?: boolean;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({
    isOpen,
    onClose,
    onSchedule,
    isLoading = false
}) => {
    // Get default datetime (5 minutes from now)
    const getDefaultDateTime = () => {
        const d = new Date();
        d.setMinutes(d.getMinutes() + 5);
        return d;
    };

    const [selectedDate, setSelectedDate] = useState<Date>(getDefaultDateTime());

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedDate(getDefaultDateTime());
        }
    }, [isOpen]);

    const handleSubmit = () => {
        console.log('[ScheduleModal] Submitting date:', selectedDate.toISOString());
        onSchedule(selectedDate);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={cn(
                            "relative w-full max-w-xs overflow-visible",
                            "bg-glass-panel border border-glass-border/30 rounded-xl",
                            "shadow-2xl shadow-black/50"
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
                            <h3 className="text-sm font-medium text-white flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-accent-cyan" />
                                Schedule Message
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-1 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Date/Time Picker */}
                        <div className="px-3 py-3 bg-black/20">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs text-white/60 uppercase tracking-wider">
                                    Select Date & Time
                                </label>
                                <DatePicker
                                    selected={selectedDate}
                                    onChange={(date: Date | null) => {
                                        if (date) {
                                            console.log('[ScheduleModal] Date changed to:', date);
                                            setSelectedDate(date);
                                        }
                                    }}
                                    showTimeSelect
                                    timeFormat="HH:mm"
                                    timeIntervals={15}
                                    dateFormat="MMM d, yyyy h:mm aa"
                                    minDate={new Date()}
                                    placeholderText="Select date and time"
                                    className="w-full"
                                />

                                {/* Preview */}
                                <div className="text-center text-xs text-white/40 mt-1">
                                    Scheduled for{' '}
                                    <span className="text-accent-cyan font-medium">
                                        {selectedDate.toLocaleString([], {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-3 py-2.5 border-t border-white/5 flex gap-2">
                            <ChromeButton
                                type="button"
                                onClick={onClose}
                                className="flex-1 text-sm py-1.5 opacity-70 hover:opacity-100 bg-white/5 hover:bg-white/10"
                            >
                                Cancel
                            </ChromeButton>
                            <ChromeButton
                                type="button"
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="flex-1 text-sm py-1.5 bg-accent-cyan/20 hover:bg-accent-cyan/30 text-accent-cyan border-accent-cyan/50"
                            >
                                {isLoading ? 'Scheduling...' : 'Confirm'}
                            </ChromeButton>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ScheduleModal;
