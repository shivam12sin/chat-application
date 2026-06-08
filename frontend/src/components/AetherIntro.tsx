import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AetherIntroProps {
    onComplete: () => void;
}

// Timing constants (in ms) - Total: 7 seconds
const STAGE_1_DURATION = 2500;   // Void: 0 - 2.5s
const STAGE_2_DURATION = 1900;  // Corruption (w/ gradual reveal): 2.5s - 4.4s
const STAGE_3_DURATION = 1100;  // Revealed (logo pauses): 4.4s - 5.5s  
const STAGE_4_DURATION = 1500;  // Zoom: 5.5s - 7s
const TOTAL_DURATION = STAGE_1_DURATION + STAGE_2_DURATION + STAGE_3_DURATION + STAGE_4_DURATION;

type Stage = 'void' | 'corruption' | 'revealed' | 'zoom' | 'complete';

// Logo size to match login page (lg size = 150px width)
const LOGO_WIDTH = 150;
const LOGO_HEIGHT = 48;

// Particle component for the corruption effect
const GlitchParticle: React.FC<{ index: number }> = ({ index }) => {
    const angle = (index / 20) * Math.PI * 2;
    const radius = 120 + Math.random() * 80;
    const size = 2 + Math.random() * 3;
    const duration = 0.8 + Math.random() * 0.6;
    const delay = Math.random() * 0.3;

    return (
        <motion.div
            className="absolute rounded-full"
            style={{
                width: size,
                height: size,
                background: index % 3 === 0 ? '#ff0040' : index % 3 === 1 ? '#00ff88' : '#4080ff',
                boxShadow: `0 0 ${size * 2}px currentColor`,
                left: '50%',
                top: '50%',
            }}
            initial={{
                x: 0,
                y: 0,
                opacity: 0,
                scale: 0
            }}
            animate={{
                x: [0, Math.cos(angle) * radius * 0.5, Math.cos(angle) * radius],
                y: [0, Math.sin(angle) * radius * 0.5, Math.sin(angle) * radius],
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0]
            }}
            transition={{
                duration,
                delay,
                ease: 'easeOut',
                repeat: Infinity,
                repeatDelay: 0.2
            }}
        />
    );
};

const AetherIntro: React.FC<AetherIntroProps> = ({ onComplete }) => {
    const [stage, setStage] = useState<Stage>('void');
    const [glitchOffset, setGlitchOffset] = useState({ x: 0, y: 0 });
    const [rgbSplit, setRgbSplit] = useState(0);
    const [logoBrightness, setLogoBrightness] = useState(10); // Start pure white
    const [logoVisible, setLogoVisible] = useState(false); // Logo fades in during void
    const glitchIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const brightnessIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Generate random glitch offsets and gradually decrease brightness during corruption
    const startGlitchEffect = useCallback(() => {
        glitchIntervalRef.current = setInterval(() => {
            setGlitchOffset({
                x: (Math.random() - 0.5) * 20,
                y: (Math.random() - 0.5) * 8
            });
            setRgbSplit(3 + Math.random() * 6);
        }, 50);

        // Gradual brightness reveal: 10 → 1 over corruption duration
        const steps = 20;
        const stepDuration = STAGE_2_DURATION / steps;
        let currentStep = 0;
        brightnessIntervalRef.current = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;
            setLogoBrightness(10 - (9 * progress)); // 10 → 1
            if (currentStep >= steps) {
                if (brightnessIntervalRef.current) clearInterval(brightnessIntervalRef.current);
            }
        }, stepDuration);
    }, []);

    const stopGlitchEffect = useCallback(() => {
        if (glitchIntervalRef.current) {
            clearInterval(glitchIntervalRef.current);
            glitchIntervalRef.current = null;
        }
        if (brightnessIntervalRef.current) {
            clearInterval(brightnessIntervalRef.current);
            brightnessIntervalRef.current = null;
        }
        setGlitchOffset({ x: 0, y: 0 });
        setRgbSplit(0);
        setLogoBrightness(1); // Ensure final brightness
    }, []);

    // Stage progression
    useEffect(() => {
        const timers: NodeJS.Timeout[] = [];

        // Fade in logo after a brief delay (during void)
        timers.push(setTimeout(() => {
            setLogoVisible(true);
        }, 300));

        // Stage 1 → Stage 2 (Void → Corruption with gradual reveal)
        timers.push(setTimeout(() => {
            setStage('corruption');
            startGlitchEffect();
        }, STAGE_1_DURATION));

        // Stage 2 → Stage 3 (Corruption → Revealed - logo pauses)
        timers.push(setTimeout(() => {
            stopGlitchEffect();
            setStage('revealed');
        }, STAGE_1_DURATION + STAGE_2_DURATION));

        // Stage 3 → Stage 4 (Revealed → Zoom)
        timers.push(setTimeout(() => {
            setStage('zoom');
        }, STAGE_1_DURATION + STAGE_2_DURATION + STAGE_3_DURATION));

        // Complete
        timers.push(setTimeout(() => {
            setStage('complete');
            onComplete();
        }, TOTAL_DURATION));

        return () => {
            timers.forEach(clearTimeout);
            stopGlitchEffect();
        };
    }, [onComplete, startGlitchEffect, stopGlitchEffect]);

    // Container variants for zoom fade effect
    const containerVariants = {
        initial: {
            scale: 1,
            opacity: 1
        },
        zoom: {
            scale: 3,
            opacity: 0,
            transition: {
                duration: STAGE_4_DURATION / 1000,
                ease: [0.4, 0, 0.2, 1] as const
            }
        }
    };

    if (stage === 'complete') return null;

    return (
        <motion.div
            ref={containerRef}
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: '#000000' }}
            variants={containerVariants}
            initial="initial"
            animate={stage === 'zoom' ? 'zoom' : 'initial'}
        >
            {/* Scanline overlay for extra grit */}
            <div
                className="absolute inset-0 pointer-events-none opacity-5"
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
                }}
            />

            {/* Screen shake wrapper */}
            <motion.div
                className="relative"
                animate={{
                    x: stage === 'corruption' ? glitchOffset.x : 0,
                    y: stage === 'corruption' ? glitchOffset.y : 0,
                }}
                transition={{ duration: 0.05 }}
            >
                {/* Particles during corruption */}
                <AnimatePresence>
                    {stage === 'corruption' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {Array.from({ length: 30 }).map((_, i) => (
                                <GlitchParticle key={i} index={i} />
                            ))}
                        </div>
                    )}
                </AnimatePresence>

                {/* RGB Split Red Channel */}
                {stage === 'corruption' && (
                    <motion.img
                        src="/src/assets/logo.svg"
                        alt=""
                        className="absolute"
                        style={{
                            width: LOGO_WIDTH,
                            height: LOGO_HEIGHT,
                            filter: `brightness(${logoBrightness}) hue-rotate(-60deg) saturate(5)`,
                            mixBlendMode: 'screen',
                            transform: `translateX(${-rgbSplit}px)`,
                            opacity: 0.7
                        }}
                    />
                )}

                {/* RGB Split Blue Channel */}
                {stage === 'corruption' && (
                    <motion.img
                        src="/src/assets/logo.svg"
                        alt=""
                        className="absolute"
                        style={{
                            width: LOGO_WIDTH,
                            height: LOGO_HEIGHT,
                            filter: `brightness(${logoBrightness}) hue-rotate(180deg) saturate(5)`,
                            mixBlendMode: 'screen',
                            transform: `translateX(${rgbSplit}px)`,
                            opacity: 0.7
                        }}
                    />
                )}

                {/* Main Logo - brightness controlled by logoBrightness state */}
                <motion.img
                    src="/src/assets/logo.svg"
                    alt="Aether"
                    className="relative"
                    style={{
                        width: LOGO_WIDTH,
                        height: LOGO_HEIGHT,
                        filter: `brightness(${logoBrightness})`,
                    }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{
                        opacity: logoVisible ? 1 : 0,
                        scale: 1
                    }}
                    transition={{
                        duration: 1.2,
                        ease: [0.16, 1, 0.3, 1]
                    }}
                />

                {/* Glitch slices during corruption */}
                {stage === 'corruption' && (
                    <>
                        <motion.div
                            className="absolute inset-0 overflow-hidden"
                            style={{
                                clipPath: 'polygon(0 30%, 100% 30%, 100% 35%, 0 35%)',
                            }}
                            animate={{
                                x: [0, 15, -10, 5, 0],
                            }}
                            transition={{
                                duration: 0.15,
                                repeat: Infinity,
                                repeatType: 'mirror'
                            }}
                        >
                            <img
                                src="/src/assets/logo.svg"
                                alt=""
                                style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT, filter: `brightness(${logoBrightness})` }}
                            />
                        </motion.div>
                        <motion.div
                            className="absolute inset-0 overflow-hidden"
                            style={{
                                clipPath: 'polygon(0 60%, 100% 60%, 100% 68%, 0 68%)',
                            }}
                            animate={{
                                x: [0, -12, 8, -3, 0],
                            }}
                            transition={{
                                duration: 0.12,
                                repeat: Infinity,
                                repeatType: 'mirror',
                                delay: 0.05
                            }}
                        >
                            <img
                                src="/src/assets/logo.svg"
                                alt=""
                                style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT, filter: `brightness(${logoBrightness})` }}
                            />
                        </motion.div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
};

export default AetherIntro;
