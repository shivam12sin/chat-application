import React from 'react';
import { cn } from '../utils/theme';
import { User } from 'lucide-react';

interface AvatarProps {
    src?: string;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    isOnline?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({
    src,
    name,
    size = 'md',
    className,
    isOnline
}) => {
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-16 h-16 text-xl',
    };

    const getInitials = (name?: string) => {
        if (!name) return '?';
        return name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    return (
        <div className={cn('relative inline-block flex-shrink-0', className)}>
            <div
                className={cn(
                    'rounded-full overflow-hidden flex items-center justify-center',
                    'border border-mono-glass-border shadow-glass-inner',
                    'bg-gradient-to-br from-mono-surface-2 to-mono-glass-highlight',
                    sizeClasses[size]
                )}
            >
                {src ? (
                    <img
                        src={src}
                        alt={name || 'Avatar'}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span className="font-medium text-mono-text/80 tracking-wide">
                        {name ? getInitials(name) : <User className="w-[60%] h-[60%]" />}
                    </span>
                )}
            </div>

            {isOnline && (
                <div
                    className={cn(
                        'absolute bottom-0 right-0 rounded-full border-2 border-mono-bg',
                        'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]',
                        size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
                    )}
                />
            )}
        </div>
    );
};

export default Avatar;
