import React from 'react';
import { cn } from '../utils/theme';

interface ChromeButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: 'default' | 'circle' | 'danger';
    'aria-label'?: string;
    title?: string;
    type?: 'button' | 'submit' | 'reset';
}

/**
 * AetherButton (formerly ChromeButton)
 * Design Philosophy: "Cosmic Liquid Glass with Metallic Memory"
 * Behavior: Quiet, heavy, machined. No bounce. No glow.
 * Performance: Optimized (Opacities only, no live blur interpolation).
 */
const ChromeButton: React.FC<ChromeButtonProps> = ({
    children,
    onClick,
    disabled = false,
    className,
    variant = 'default',
    'aria-label': ariaLabel,
    title,
    type = 'button',
}) => {
    const isCircle = variant === 'circle';
    const isDanger = variant === 'danger';

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            title={title}
            className={cn(
                // Base Layout
                'relative overflow-hidden isolate',
                isCircle ? 'rounded-full aspect-square' : 'rounded-xl',
                isCircle ? 'p-0' : 'px-4 py-2',

                // 1. CORE MATERIAL IDENTITY
                // Default vs Danger
                !isDanger && 'bg-mono-surface/5 border-white/5 text-mono-text',
                isDanger && 'bg-red-500/10 border-red-500/20 text-red-100', // Danger Base

                // Text Font
                'font-medium text-sm',

                // 5. TRANSITION TIMING
                'transition-all duration-300 ease-out',

                // 2. DEFAULT STATE
                'shadow-sm',

                // 3. HOVER (Space Bending)
                !isDanger && 'hover:bg-mono-surface/10 hover:border-white/10 hover:shadow-md',
                isDanger && 'hover:bg-red-500/20 hover:border-red-500/30 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]',

                // 4. CLICK / ACTIVE (Pressure)
                !isDanger && 'active:bg-mono-surface/15 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] active:border-white/5',
                isDanger && 'active:bg-red-500/25 active:shadow-[inset_0_2px_4px_rgba(127,29,29,0.4)] active:border-red-500/20',

                'active:translate-y-[0px]', // STRICTLY NO MOTION

                // Disabled state
                'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',

                className
            )}
        >
            {/* 
               Subtle Metallic Gradient Overlay (Static) 
            */}
            <div
                className="absolute inset-0 z-[-1] opacity-5 pointer-events-none"
                style={{
                    background: `linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.1) 100%)`
                }}
            />

            {/* Content Content centered */}
            <span className={cn(
                "relative z-10 flex items-center justify-center gap-2",
                isCircle ? "w-full h-full" : ""
            )}>
                {children}
            </span>
        </button>
    );
};

export default ChromeButton;
