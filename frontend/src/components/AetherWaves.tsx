import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
import { cn } from '../utils/theme';

interface AetherWavesProps {
    audioUrl: string;
    fileName?: string;
    className?: string;
}

const AetherWaves: React.FC<AetherWavesProps> = ({ audioUrl, fileName, className }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const contextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const animationRef = useRef<number>();

    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        if (!audioRef.current) {
            const audio = new Audio();
            audio.crossOrigin = "anonymous";
            audioRef.current = audio;

            const updateDuration = () => {
                const d = audio.duration;
                if (d && d !== Infinity && !isNaN(d)) {
                    setDuration(d);
                }
            };

            audio.addEventListener('loadedmetadata', () => updateDuration());
            audio.addEventListener('durationchange', () => updateDuration());
            audio.addEventListener('canplay', () => updateDuration());
            audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime || 0));
            audio.addEventListener('ended', () => {
                setIsPlaying(false);
                if (animationRef.current) cancelAnimationFrame(animationRef.current);
            });
            audio.addEventListener('error', (e) => console.error("Audio Load Error", e));
        }

        const audio = audioRef.current;
        if (audio && audio.src !== audioUrl) {
            audio.src = audioUrl;
            audio.load();
        }

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [audioUrl]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
            if (contextRef.current && contextRef.current.state !== 'closed') {
                contextRef.current.close();
            }
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    const setupAudioContext = () => {
        if (contextRef.current || !audioRef.current) return;

        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            contextRef.current = new AudioContext();
            analyserRef.current = contextRef.current.createAnalyser();
            analyserRef.current.smoothingTimeConstant = 0.85;
            analyserRef.current.fftSize = 256;

            sourceRef.current = contextRef.current.createMediaElementSource(audioRef.current);
            sourceRef.current.connect(analyserRef.current);
            analyserRef.current.connect(contextRef.current.destination);
        } catch (e) {
            console.error("Web Audio API not supported", e);
        }
    };

    const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        const width = canvas.width;
        const height = canvas.height;
        const centerY = height / 2;

        ctx.clearRect(0, 0, width, height);

        // Gradient for the wave (kept original colors)
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#8b5cf6'); // Violet
        gradient.addColorStop(0.5, '#ec4899'); // Pink
        gradient.addColorStop(1, '#06b6d4'); // Cyan

        ctx.lineWidth = 2;
        ctx.strokeStyle = gradient;
        ctx.fillStyle = "rgba(139, 92, 246, 0.1)";

        ctx.beginPath();

        const sliceWidth = width / (bufferLength / 2);
        let x = 0;

        ctx.moveTo(0, centerY);

        for (let i = 0; i < bufferLength / 2; i++) {
            const v = dataArray[i] / 255.0;
            const amplitude = v * (height / 2.5);
            const y = centerY - amplitude;

            const nextX = x + sliceWidth;
            const nextV = (i + 1 < bufferLength / 2) ? dataArray[i + 1] / 255.0 : 0;
            const nextY = centerY - (nextV * (height / 2.5));

            const xc = (x + nextX) / 2;
            const yc = (y + nextY) / 2;

            ctx.quadraticCurveTo(x, y, xc, yc);

            x += sliceWidth;
        }

        ctx.lineTo(width, centerY);

        for (let i = Math.floor(bufferLength / 2) - 1; i >= 0; i--) {
            const v = dataArray[i] / 255.0;
            const amplitude = v * (height / 2.5);
            const y = centerY + amplitude;

            const currentX = i * sliceWidth;
            ctx.lineTo(currentX, y);
        }

        ctx.closePath();
        ctx.stroke();
        ctx.fill();

        animationRef.current = requestAnimationFrame(draw);
    };

    const togglePlay = async () => {
        if (!audioRef.current) return;

        if (!contextRef.current) setupAudioContext();
        if (contextRef.current?.state === 'suspended') await contextRef.current.resume();

        if (isPlaying) {
            audioRef.current.pause();
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        } else {
            audioRef.current.play();
            draw();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
        audioRef.current.currentTime = percent * duration;
        setCurrentTime(percent * duration);
    };

    const formatTime = (time: number) => {
        if (!time || isNaN(time) || time === Infinity) return "0:00";
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "relative w-[280px] h-[100px]",
                "rounded-2xl overflow-hidden",
                "bg-white/5 backdrop-blur-glass border border-white/10", // Frosted glass
                className
            )}
        >
            <canvas
                ref={canvasRef}
                width={280}
                height={100}
                className="absolute inset-0 w-full h-full opacity-80"
            />

            <div className="absolute inset-0 flex flex-col justify-between p-3 z-10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={togglePlay}
                        className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-glass flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                    >
                        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-white text-sm font-medium truncate">{fileName || "Audio Recording"}</h4>
                        <p className="text-white/50 text-xs">{formatTime(currentTime)} / {formatTime(duration)}</p>
                    </div>
                </div>

                <div
                    className="w-full h-3 flex items-center cursor-pointer group"
                    onClick={handleSeek}
                >
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-purple-400 to-pink-400"
                            style={{ width: `${(currentTime / duration) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default AetherWaves;
