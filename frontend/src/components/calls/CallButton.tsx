import React, { useState } from 'react';
import { Phone, Video, Loader2 } from 'lucide-react';

interface CallButtonProps {
    type: 'voice' | 'video';
    onCallStart: (type: 'voice' | 'video') => void;
}

const CallButton: React.FC<CallButtonProps> = ({ type, onCallStart }) => {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        setLoading(true);
        // Execute the parent's handler
        onCallStart(type);
        // Reset loading after a delay to prevent spam
        setTimeout(() => setLoading(false), 2000);
    };

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors relative group"
            title={type === 'voice' ? 'Voice Call' : 'Video Call'}
        >
            {loading ? (
                <Loader2 size={20} className="animate-spin" />
            ) : type === 'voice' ? (
                <Phone size={20} />
            ) : (
                <Video size={20} />
            )}

            {/* Tooltip */}
            <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 text-xs bg-black/90 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {type === 'voice' ? 'Voice Call' : 'Video Call'}
            </span>
        </button>
    );
};

export default CallButton;
