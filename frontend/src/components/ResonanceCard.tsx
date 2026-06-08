import React, { useState, useRef, useEffect } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/theme';

interface ResonanceCardProps {
    videoId: string;
    title: string;
    channelTitle?: string;
    thumbnailUrl: string;
    className?: string;
    autoPlay?: boolean;
}

const ResonanceCard: React.FC<ResonanceCardProps> = ({
    videoId,
    title,
    channelTitle,
    thumbnailUrl,
    className,
    autoPlay = false
}) => {
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [progress, setProgress] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const playerRef = useRef<any>(null);

    // YouTube Player Options
    const opts: YouTubeProps['opts'] = {
        height: '0',
        width: '0',
        playerVars: {
            autoplay: autoPlay ? 1 : 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
        },
    };

    const handleStateChange = (event: any) => {
        const playerState = event.data;
        if (playerState === 1) { // Playing
            setIsPlaying(true);
        } else if (playerState === 2 || playerState === 0) { // Paused or Ended
            setIsPlaying(false);
        }
    };

    // Progress Interval
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isPlaying && playerRef.current) {
            interval = setInterval(() => {
                const currentTime = playerRef.current.getCurrentTime();
                const totalDuration = playerRef.current.getDuration();
                if (totalDuration) {
                    setProgress((currentTime / totalDuration) * 100);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    // Seek Functionality
    const progressBarRef = useRef<HTMLDivElement>(null);

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!playerRef.current || !progressBarRef.current) return;

        const rect = progressBarRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percentage = Math.min(Math.max(x / width, 0), 1); // Clamp 0-1

        const duration = playerRef.current.getDuration();
        if (duration) {
            const seekTime = duration * percentage;
            playerRef.current.seekTo(seekTime);
            setProgress(percentage * 100);
        }
    };

    const togglePlay = () => {
        if (!playerRef.current) return; // Wait for ready
        if (isPlaying) {
            playerRef.current.pauseVideo();
        } else {
            playerRef.current.playVideo();
        }
        setIsPlaying(!isPlaying); // Optimistic Toggle
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className={cn("relative w-[160px] h-[190px] rounded-2xl overflow-hidden group select-none shadow-glass-lg", className)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* 1. Background - Deep Cosmic Purple (Matches 'This Summer' dark tones) */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a103c] via-[#2D1B69] to-[#1a103c]">
                {/* Subtle Aurora Pulse */}
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/20 via-transparent to-blue-900/20 opacity-30" />
            </div>

            {/* Glass Texture */}
            <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]" />

            <div className="relative w-full h-full flex flex-col items-center p-3">

                {/* 2. The Vinyl (Centerpiece) - Mini Size */}
                <div className="relative mt-2 mb-3 w-[90px] h-[90px] flex items-center justify-center">
                    {/* Spinning Record */}
                    <motion.div
                        animate={{ rotate: isPlaying ? 360 : 0 }}
                        transition={{
                            repeat: isPlaying ? Infinity : 0,
                            duration: 6,
                            ease: "linear"
                        }}
                        className={cn(
                            "relative w-full h-full rounded-full shadow-2xl overflow-hidden ring-2 ring-white/10",
                        )}
                    >
                        <img
                            src={thumbnailUrl}
                            alt="Album Art"
                            className="w-full h-full object-cover opacity-90"
                        />
                        {/* Vinyl Textures */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10 pointer-events-none rounded-full" />
                        <div className="absolute inset-0 rounded-full border border-white/5" />
                        <div className="absolute inset-0 m-auto w-1.5 h-1.5 bg-[#1a103c] rounded-full border border-white/20" />
                    </motion.div>

                    {/* Play/Pause Button - Perfectly Centered Overlay */}
                    <AnimatePresence>
                        {(isHovering || !isPlaying) && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={togglePlay}
                                className={cn(
                                    "absolute inset-0 m-auto w-8 h-8 rounded-full",
                                    "bg-white/20 backdrop-blur-glass border border-white/30 shadow-lg",
                                    "flex items-center justify-center text-white hover:scale-110 transition-transform",
                                    "z-20 cursor-pointer"
                                )}
                            >
                                {isPlaying ? (
                                    <Pause className="w-3.5 h-3.5 fill-current" />
                                ) : (
                                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                )}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* 3. Info & Progress */}
                <div className="w-full flex flex-col gap-1.5 relative z-10 px-0.5">
                    <div className="text-center space-y-0">
                        <h3 className="text-white font-semibold text-xs leading-tight truncate px-1 drop-shadow-md">
                            {title}
                        </h3>
                        <p className="text-white/50 text-[10px] font-medium truncate px-1">
                            {channelTitle || 'YouTube'}
                        </p>
                    </div>

                    {/* Progress Bar (Clickable Wrapper) */}
                    <div
                        ref={progressBarRef}
                        onClick={handleSeek}
                        className="w-full h-4 flex items-center cursor-pointer group/seek mt-0.5"
                    >
                        {/* Visual Track */}
                        <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden relative">
                            <motion.div
                                className="h-full bg-gradient-to-r from-purple-400 to-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.5)] group-hover/seek:shadow-[0_0_12px_rgba(236,72,153,0.8)] transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden Player */}
            <div className="hidden">
                <YouTube
                    videoId={videoId}
                    opts={opts}
                    onReady={(e: any) => { playerRef.current = e.target; }}
                    onStateChange={handleStateChange}
                />
            </div>
        </motion.div>
    );
};

export default ResonanceCard;
