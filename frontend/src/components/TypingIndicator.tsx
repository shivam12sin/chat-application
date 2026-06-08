import React from 'react';
import { cn } from '../utils/theme';

interface TypingIndicatorProps {
  users?: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
  className?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  users = [],
  className,
}) => {
  if (users.length === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-2 px-3 rounded-glass',
        'bg-mono-surface-2 border border-mono-glass-border',
        'animate-fade-up',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={`${users.map((u) => u.name).join(', ')} ${users.length === 1 ? 'is' : 'are'} typing`}
    >
      {/* Avatar stack */}
      <div className="flex -space-x-1">
        {users.slice(0, 2).map((user) => (
          <div
            key={user.id}
            className={cn(
              'w-5 h-5 rounded-full border border-mono-glass-border',
              'bg-mono-surface flex items-center justify-center',
              'text-mono-muted text-xs font-medium',
              'flex-shrink-0'
            )}
            title={user.name}
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </div>
        ))}
        {users.length > 2 && (
          <div
            className={cn(
              'w-5 h-5 rounded-full border border-mono-glass-border',
              'bg-mono-surface flex items-center justify-center',
              'text-mono-muted text-xs font-medium',
              'flex-shrink-0'
            )}
            title={users.slice(2).map((u) => u.name).join(', ')}
          >
            +{users.length - 2}
          </div>
        )}
      </div>

      {/* Typing dots */}
      <div className="flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'w-2 h-2 rounded-full bg-mono-muted/60',
              'animate-pulse'
            )}
            style={{
              animationDelay: `${i * 100}ms`,
            }}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Text */}
      <span className="text-xs text-mono-muted ml-1">
        {users.length === 1
          ? `${users[0].name} is typing`
          : `${users.map((u) => u.name).join(', ')} are typing`}
      </span>
    </div>
  );
};

export default TypingIndicator;
