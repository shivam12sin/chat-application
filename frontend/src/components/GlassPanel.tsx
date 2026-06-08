import React, { ReactNode } from 'react';

type GlassPanelVariant = 'default' | 'elevated' | 'ghost';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassPanelVariant;
  interactive?: boolean;
  children: ReactNode;
  role?: string;
  'aria-label'?: string;
}

const clsx = (...classes: (string | undefined | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    {
      variant = 'default',
      interactive = false,
      children,
      className,
      role,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: 'glass-panel',
      elevated: 'glass-panel shadow-glass-lg',
      ghost: 'backdrop-blur-glass-light bg-mono-surface-2 border border-transparent rounded-glass',
    };

    const interactiveStyles = interactive
      ? 'hover:translate-y-[-2px] active:scale-98 cursor-pointer hover:bg-mono-surface/90 hover:border-mono-glass-highlight'
      : '';

    const baseStyles = clsx(
      variants[variant],
      interactiveStyles,
      'animate-fade-up', // Default entrance animation
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mono-text/30',
      className
    );

    return (
      <div
        ref={ref}
        role={role}
        aria-label={ariaLabel}
        className={baseStyles}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassPanel.displayName = 'GlassPanel';

export default GlassPanel;
