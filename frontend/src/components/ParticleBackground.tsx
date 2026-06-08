import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface Particle {
    x: number;
    y: number;
    z: number; // For depth/parallax
    size: number;
    baseX: number; // Original position for parallax
    baseY: number;
    vx: number;
    vy: number;
    opacity: number;
    baseOpacity: number;
    pulseSpeed: number;
    life?: number; // For transient particles
    type: 'star' | 'burst';
}

const ParticleBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const location = useLocation();
    const particles = useRef<Particle[]>([]);
    const animationFrameId = useRef<number>();

    // State for effects
    const isAwakening = useRef(false);
    const mouse = useRef({ x: 0, y: 0 });

    // P0: Performance optimization state
    const isVisible = useRef(true);
    const lastMouseMove = useRef(Date.now());
    const isIdle = useRef(false);

    // Configuration
    const STAR_COUNT = 20; // Ultra-optimized count
    const BASE_SPEED = 0.05; // Almost frozen
    const AWAKEN_SPEED_MULTIPLIER = 8;
    const PARALLAX_STRENGTH = 15; // How much mouse moves them
    const IDLE_THRESHOLD = 3000; // 3 seconds before STOPPING animation
    const isAnimating = useRef(true); // Track if animation loop is running

    // Offscreen sprite for performance
    const spriteRef = useRef<HTMLCanvasElement | null>(null);

    // Initialize Sprite (The glowing star texture)
    useEffect(() => {
        const sprite = document.createElement('canvas');
        sprite.width = 30;
        sprite.height = 30;
        const ctx = sprite.getContext('2d');
        if (ctx) {
            const centerX = sprite.width / 2;
            const centerY = sprite.height / 2;
            const radius = 4; // Core size

            // Draw glowing star
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            // Heavy glow baked in
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(220, 230, 255, 0.8)';
            ctx.fill();

            // Extra subtle glow ring for outer softness
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(220, 230, 255, 0.1)';
            ctx.fill();
        }
        spriteRef.current = sprite;
    }, []);

    const initParticles = (width: number, height: number) => {
        particles.current = [];
        for (let i = 0; i < STAR_COUNT; i++) {
            const z = Math.random() * 0.5 + 0.5; // Depth factor 0.5 - 1.0
            particles.current.push({
                x: Math.random() * width,
                y: Math.random() * height,
                z,
                size: (Math.random() * 1.5 + 0.5) * z, // Smaller if further
                baseX: 0, // Set in loop
                baseY: 0,
                vx: (Math.random() - 0.5) * BASE_SPEED,
                vy: (Math.random() - 0.5) * BASE_SPEED,
                baseOpacity: Math.random() * 0.4 + 0.1, // Faint
                opacity: 0, // Start invisible, fade in
                pulseSpeed: Math.random() * 0.005 + 0.002, // Slow pulse
                type: 'star',
            });
            // Set initial base positions
            particles.current[i].baseX = particles.current[i].x;
            particles.current[i].baseY = particles.current[i].y;
        }
    };

    // "Awaken" - The Cosmic Dissolve Trigger
    useEffect(() => {
        isAwakening.current = true;
        const timer = setTimeout(() => {
            isAwakening.current = false;
        }, 800); // Duration of awakening
        return () => clearTimeout(timer);
    }, [location.pathname]);

    // P6: Removed click burst particles for GPU savings
    // Keeping only the cosmic:input ripple effect (on send message)
    useEffect(() => {
        const handleCosmicInput = () => {
            // Ripple effect: add transient particles at bottom center (reduced count)
            const centerX = window.innerWidth / 2;
            const height = window.innerHeight;
            // P6: Reduced from 5 to 2 particles
            for (let i = 0; i < 2; i++) {
                particles.current.push({
                    x: centerX,
                    y: height - 50,
                    z: 1,
                    size: Math.random() * 2 + 1,
                    baseX: centerX,
                    baseY: height - 50,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() * -1) - 1,
                    opacity: 0.8,
                    baseOpacity: 0,
                    pulseSpeed: 0,
                    type: 'burst',
                    life: 1.0
                });
            }
        };

        // P6: Removed click handler entirely - no more click bursts
        window.addEventListener('cosmic:input', handleCosmicInput);
        return () => {
            window.removeEventListener('cosmic:input', handleCosmicInput);
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // P1: Handle Resolution - Use dpr=1 for particles (no Retina scaling needed)
        const handleResize = () => {
            // P1: Removed devicePixelRatio - particles don't need Retina precision
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;

            initParticles(window.innerWidth, window.innerHeight);
        };

        const handleMouseMove = (e: MouseEvent) => {
            // Normalize mouse -1 to 1
            mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
            // P0: Reset idle timer on mouse move
            lastMouseMove.current = Date.now();
            isIdle.current = false;

            // P0: Restart animation if it was stopped
            if (!isAnimating.current && isVisible.current) {
                isAnimating.current = true;
                animationFrameId.current = requestAnimationFrame(animate);
            }
        };

        // P5: Use passive listeners for better scroll performance
        window.addEventListener('resize', handleResize, { passive: true });
        window.addEventListener('mousemove', handleMouseMove, { passive: true });

        // P0: Handle visibility changes - restart when tab becomes visible
        const handleVisibility = () => {
            isVisible.current = !document.hidden;
            if (!document.hidden && !isAnimating.current) {
                isAnimating.current = true;
                lastMouseMove.current = Date.now();
                requestAnimationFrame(animate);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        handleResize();

        let time = 0;
        const animate = () => {
            // P0: COMPLETELY STOP if tab is hidden (no more rAF calls)
            if (!isVisible.current) {
                isAnimating.current = false;
                return; // EXIT - no more rAF scheduled
            }

            // P0: COMPLETELY STOP if idle for IDLE_THRESHOLD ms
            if (Date.now() - lastMouseMove.current > IDLE_THRESHOLD) {
                isIdle.current = true;
                isAnimating.current = false;
                return; // EXIT - no more rAF scheduled, mouse move will restart
            }

            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            time += 0.01;

            particles.current.forEach((p) => {
                // 0. Context Awareness (Sidebar vs Chat)
                const isSidebar = p.x < 320;

                // 1. Movement Logic
                let speedMultiplier = isAwakening.current ? AWAKEN_SPEED_MULTIPLIER : 1;

                if (isSidebar) {
                    p.x += (p.vx * 0.5) * speedMultiplier;
                    p.y += (p.vy * 0.3) * speedMultiplier;
                } else {
                    p.x += p.vx * speedMultiplier;
                    p.y += p.vy * speedMultiplier;
                }

                // 2. Parallax
                const targetX = p.x + (mouse.current.x * PARALLAX_STRENGTH * p.z);
                const targetY = p.y + (mouse.current.y * PARALLAX_STRENGTH * p.z);

                // 3. Screen Wrap
                if (p.x < -50) p.x = window.innerWidth + 50;
                if (p.x > window.innerWidth + 50) p.x = -50;
                if (p.y < -50) p.y = window.innerHeight + 50;
                if (p.y > window.innerHeight + 50) p.y = -50;

                // 4. Pulse
                if (p.type === 'star') {
                    p.opacity = p.baseOpacity + Math.sin(time * p.pulseSpeed * 100) * 0.05;
                } else if (p.type === 'burst' && p.life !== undefined) {
                    p.life -= 0.03;
                    p.opacity = p.life;
                    p.x += p.vx;
                    p.y += p.vy;
                }

                if (p.opacity <= 0 && p.type === 'burst') return;

                // Draw using Optimized Sprite approach
                if (spriteRef.current) {
                    // Safe globalAlpha check
                    const alpha = Math.max(0, Math.min(1, p.opacity));
                    ctx.globalAlpha = alpha;

                    // Draw image centered at target coordinates
                    const drawSize = p.size * 5; // Scale factor relative to sprite core
                    ctx.drawImage(
                        spriteRef.current,
                        targetX - drawSize / 2,
                        targetY - drawSize / 2,
                        drawSize, // width
                        drawSize  // height
                    );

                    // Reset alpha for next iteration
                    ctx.globalAlpha = 1.0;
                }
            });

            // Cleanup dead particles
            particles.current = particles.current.filter(p => p.type === 'star' || (p.life !== undefined && p.life > 0));

            animationFrameId.current = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('visibilitychange', handleVisibility);
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[-1]"
        />
    );
};

export default ParticleBackground;
