import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logoSvg from '../assets/logo.svg';

interface AetherLogoProps {
    /** Size variant: 'sm' for sidebar, 'md' for headers, 'lg' for login/register */
    size?: 'sm' | 'md' | 'lg';
    /** Optional className for additional styling */
    className?: string;
}

/**
 * AetherLogo - Displays the Aether logo with hover-activated distortion effect
 * Uses SVG displacement mapping to create a gravitational lensing illusion ON HOVER ONLY
 */
const AetherLogo: React.FC<AetherLogoProps> = ({
    size = 'md',
    className = '',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    // Size configurations (maintaining 116:37 aspect ratio)
    const sizeConfig = {
        sm: { height: 24, width: 75 },   // Sidebar
        md: { height: 32, width: 100 },  // General headers
        lg: { height: 48, width: 150 },  // Login/Register pages
    };

    const { height, width } = sizeConfig[size];

    // Unique filter ID to avoid conflicts when multiple logos are rendered
    const filterId = `aether-distortion-${size}`;

    return (
        <div
            ref={containerRef}
            className={`relative inline-flex items-center justify-center ${className}`}
            style={{ width, height }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* SVG Filter Definition for Gravitational Distortion - Always present but only applied on hover */}
            <svg
                className="absolute w-0 h-0 overflow-hidden"
                aria-hidden="true"
            >
                <defs>
                    <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
                        {/* Turbulence for organic distortion pattern - STATIC, no animate */}
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.018"
                            numOctaves="2"
                            result="turbulence"
                        />
                        {/* Displacement mapping - warps pixels based on turbulence */}
                        <feDisplacementMap
                            in="SourceGraphic"
                            in2="turbulence"
                            scale="4"
                            xChannelSelector="R"
                            yChannelSelector="G"
                        />
                    </filter>
                </defs>
            </svg>

            {/* Outer Glow - Event Horizon Effect - ON HOVER ONLY */}
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                            background: `radial-gradient(ellipse at center, rgba(240, 240, 240, 0.2) 0%, transparent 70%)`,
                            filter: 'blur(8px)',
                            transform: 'scale(2)',
                        }}
                        initial={{ opacity: 0, scale: 1.5 }}
                        animate={{ opacity: 0.4, scale: 2 }}
                        exit={{ opacity: 0, scale: 1.5 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                    />
                )}
            </AnimatePresence>

            {/* The Logo Image - Static, High Performance */}
            <motion.img
                src={logoSvg}
                alt="Aether"
                className="relative z-10"
                style={{
                    width,
                    height,
                    filter: isHovered ? `url(#${filterId})` : undefined,
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.2, 0.9, 0.2, 1] }}
                whileHover={{ scale: 1.02, filter: `url(#${filterId}) brightness(1.1)` }}
            />
        </div>
    );
};

export default AetherLogo;
