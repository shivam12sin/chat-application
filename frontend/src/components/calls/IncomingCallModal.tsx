import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface IncomingCallModalProps {
    visible: boolean;
    callerName: string;
    callType: 'voice' | 'video';
    onAccept: () => void;
    onReject: () => void;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
    visible,
    callerName,
    callType,
    onAccept,
    onReject
}) => {
    // Ringtone effect could be added here

    return (
        <AnimatePresence>
            {visible && (
                <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, y: -50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        className="bg-black/90 border border-white/10 backdrop-blur-xl p-6 rounded-2xl shadow-2xl pointer-events-auto flex flex-col items-center gap-6 w-80"
                    >
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center animate-pulse">
                                {callType === 'voice' ? <Phone size={32} className="text-white" /> : <Video size={32} className="text-white" />}
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-medium text-white">{callerName}</h3>
                                <p className="text-sm text-zinc-400">Incoming {callType} call...</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 w-full justify-center">
                            <button
                                onClick={onReject}
                                className="w-14 h-14 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                                title="Decline"
                            >
                                <PhoneOff size={24} />
                            </button>
                            <button
                                onClick={onAccept}
                                className="w-14 h-14 rounded-full bg-green-500/20 text-green-500 hover:bg-green-500 hover:text-white flex items-center justify-center transition-all animate-bounce"
                                title="Accept"
                            >
                                <Phone size={24} />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default IncomingCallModal;
