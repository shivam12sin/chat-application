import React, { useEffect } from 'react';
import { cn } from '../utils/theme';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps extends Toast {
  onDismiss: (id: string) => void;
}

export const ToastItem: React.FC<ToastProps> = ({
  id,
  message,
  type,
  duration = 4000,
  action,
  onDismiss,
}) => {
  useEffect(() => {
    if (duration === 0) return;

    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const typeStyles = {
    success: {
      bg: 'bg-white/10 border-white/20 shadow-glass',
      icon: (
        <div className="rounded-full bg-white/20 p-0.5">
          <svg
            className="w-5 h-5 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      ),
      text: 'text-white',
    },
    error: {
      bg: 'bg-white/10 border-white/20 shadow-glass',
      icon: (
        <div className="rounded-full bg-white/20 p-0.5">
          <svg
            className="w-5 h-5 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      ),
      text: 'text-white',
    },
    warning: {
      bg: 'bg-white/10 border-white/20 shadow-glass',
      icon: (
        <div className="rounded-full bg-white/20 p-0.5">
          <svg
            className="w-5 h-5 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      ),
      text: 'text-white',
    },
    info: {
      bg: 'bg-white/10 border-white/20 shadow-glass',
      icon: (
        <div className="rounded-full bg-white/20 p-0.5">
          <svg
            className="w-5 h-5 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      ),
      text: 'text-white',
    },
  };

  const style = typeStyles[type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3',
        'rounded-glass border',
        'bg-mono-surface/80 backdrop-blur-glass',
        style.bg,
        'animate-slide-up',
        'shadow-lg'
      )}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="flex-shrink-0 pt-0.5">{style.icon}</div>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', style.text)}>
          {message}
        </p>
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            'flex-shrink-0 px-3 py-1 rounded-glass text-xs font-medium',
            'bg-mono-surface hover:bg-mono-surface/80',
            'border border-mono-glass-border hover:border-mono-glass-highlight',
            style.text,
            'transition-all duration-fast ease-glass',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-mono-text/50',
            'active:scale-95 hover:translate-y-[-1px]',
            'whitespace-nowrap'
          )}
        >
          {action.label}
        </button>
      )}

      <button
        onClick={() => onDismiss(id)}
        className={cn(
          'flex-shrink-0 p-1 rounded-glass',
          'bg-mono-surface-2 hover:bg-mono-surface/40',
          'border border-transparent hover:border-mono-glass-border',
          'text-mono-muted hover:text-mono-text',
          'transition-all duration-fast ease-glass',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-mono-text/50',
          'active:scale-95'
        )}
        aria-label="Close notification"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  position = 'top-right',
}) => {
  const positionStyles = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div
      className={cn(
        'fixed z-50 pointer-events-none',
        positionStyles[position],
        'flex flex-col gap-2 max-w-[360px]'
      )}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem
            {...toast}
            onDismiss={onDismiss}
          />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
