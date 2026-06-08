import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, VolumeX, Volume2, Ban, UserCheck, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { cn } from '../utils/theme';
import ChromeButton from './ChromeButton';
import MuteModal from './MuteModal';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface RoomOptionsMenuProps {
    roomId: number;
    userId?: number;
    roomName: string;
    isMuted?: boolean;
    isBlocked?: boolean;
    isLocked?: boolean;
    token: string;
    onMuteChange?: (muted: boolean) => void;
    onBlockChange?: (blocked: boolean) => void;
    onLockChange?: (locked: boolean) => void;
    className?: string;
}

const RoomOptionsMenu: React.FC<RoomOptionsMenuProps> = ({
    roomId,
    userId,
    roomName,
    isMuted = false,
    isBlocked = false,
    isLocked = false,
    token,
    onMuteChange,
    onBlockChange,
    onLockChange,
    className
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMuteModalOpen, setIsMuteModalOpen] = useState(false);
    const [localMuted, setLocalMuted] = useState(isMuted);
    const [localBlocked, setLocalBlocked] = useState(isBlocked);
    const [localLocked, setLocalLocked] = useState(isLocked);
    const [isLoading, setIsLoading] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
    const buttonRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current && !menuRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Update menu position when opened
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right
            });
        }
    }, [isOpen]);

    // Animation Variants - matching SettingsMenu/AttachmentMenu
    const menuVariants: Variants = {
        hidden: {
            opacity: 0,
            scale: 0.95,
            y: -10,
            transition: { duration: 0.15, ease: "easeOut" }
        },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
                type: "spring",
                stiffness: 300,
                damping: 30,
                staggerChildren: 0.05
            }
        },
        exit: {
            opacity: 0,
            scale: 0.95,
            y: -10,
            transition: { duration: 0.15, ease: "easeIn" }
        }
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, x: -10, filter: "blur(4px)" },
        visible: {
            opacity: 1,
            x: 0,
            filter: "blur(0px)",
            transition: { duration: 0.2 }
        }
    };

    const handleMuteWithDuration = async (until?: Date) => {
        setIsLoading(true);
        try {
            await axios.post(`${API_URL}/rooms/${roomId}/mute`,
                { until: until?.toISOString() },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setLocalMuted(true);
            onMuteChange?.(true);
        } catch (error) {
            console.error('Mute room error:', error);
        } finally {
            setIsLoading(false);
            setIsMuteModalOpen(false);
        }
    };

    const handleUnmute = async () => {
        setIsLoading(true);
        try {
            await axios.post(`${API_URL}/rooms/${roomId}/unmute`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLocalMuted(false);
            onMuteChange?.(false);
        } catch (error) {
            console.error('Unmute room error:', error);
        } finally {
            setIsLoading(false);
            setIsOpen(false);
        }
    };

    const handleBlockUser = async () => {
        if (!userId) return;
        setIsLoading(true);
        try {
            if (localBlocked) {
                await axios.post(`${API_URL}/users/${userId}/unblock`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setLocalBlocked(false);
                onBlockChange?.(false);
            } else {
                await axios.post(`${API_URL}/users/${userId}/block`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setLocalBlocked(true);
                onBlockChange?.(true);
            }
        } catch (error) {
            console.error('Block user error:', error);
        } finally {
            setIsLoading(false);
            setIsOpen(false);
        }
    };

    const menuContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={menuRef}
                    variants={menuVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className={cn(
                        "fixed w-56",
                        "bg-mono-bg/95 backdrop-blur-glass border border-mono-glass-border",
                        "rounded-2xl shadow-2xl overflow-hidden p-1"
                    )}
                    style={{
                        top: menuPosition.top,
                        right: menuPosition.right,
                        zIndex: 9999,
                        transformOrigin: "top right"
                    }}
                >
                    {/* Mute Option */}
                    <motion.button
                        variants={itemVariants}
                        onClick={() => {
                            if (localMuted) {
                                handleUnmute();
                            } else {
                                setIsOpen(false);
                                setIsMuteModalOpen(true);
                            }
                        }}
                        disabled={isLoading}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5",
                            "text-sm text-mono-text hover:bg-mono-surface",
                            "rounded-xl transition-colors text-left group",
                            isLoading && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {localMuted ? (
                            <>
                                <Volume2 className="w-4 h-4 text-mono-muted group-hover:text-mono-text transition-colors" />
                                <span className="font-medium">Unmute {roomName}</span>
                            </>
                        ) : (
                            <>
                                <VolumeX className="w-4 h-4 text-mono-muted group-hover:text-mono-text transition-colors" />
                                <span className="font-medium">Mute {roomName}</span>
                            </>
                        )}
                    </motion.button>

                    {/* Block Option */}
                    {userId && (
                        <motion.button
                            variants={itemVariants}
                            onClick={handleBlockUser}
                            disabled={isLoading}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5",
                                "text-sm hover:bg-mono-surface",
                                "rounded-xl transition-colors text-left group",
                                localBlocked ? "text-green-400 hover:text-green-300" : "text-red-400 hover:text-red-300",
                                isLoading && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            {localBlocked ? (
                                <>
                                    <UserCheck className="w-4 h-4" />
                                    <span className="font-medium">Unblock User</span>
                                </>
                            ) : (
                                <>
                                    <Ban className="w-4 h-4" />
                                    <span className="font-medium">Block User</span>
                                </>
                            )}
                        </motion.button>
                    )}

                    {/* Lock Option */}
                    <motion.button
                        variants={itemVariants}
                        onClick={() => {
                            const newLocked = !localLocked;
                            setLocalLocked(newLocked);
                            onLockChange?.(newLocked);
                            setIsOpen(false);
                        }}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5",
                            "text-sm hover:bg-mono-surface",
                            "rounded-xl transition-colors text-left group",
                            "text-amber-400 hover:text-amber-300"
                        )}
                    >
                        {localLocked ? (
                            <>
                                <Unlock className="w-4 h-4" />
                                <span className="font-medium">Unlock Chat</span>
                            </>
                        ) : (
                            <>
                                <Lock className="w-4 h-4" />
                                <span className="font-medium">Lock Chat</span>
                            </>
                        )}
                    </motion.button>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            <div className={cn("relative", className)} ref={buttonRef}>
                <ChromeButton
                    variant="circle"
                    className={cn(
                        "p-2 min-h-[40px] min-w-[40px] flex items-center justify-center",
                        isOpen ? "text-mono-text bg-mono-surface" : "text-mono-muted hover:text-mono-text"
                    )}
                    aria-label="More options"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <MoreVertical className="w-5 h-5" />
                </ChromeButton>
            </div>

            {/* Portal the dropdown to body to avoid overflow issues */}
            {createPortal(menuContent, document.body)}

            {/* Mute Duration Modal */}
            <MuteModal
                isOpen={isMuteModalOpen}
                onClose={() => setIsMuteModalOpen(false)}
                onMute={handleMuteWithDuration}
                targetName={roomName}
                isLoading={isLoading}
            />
        </>
    );
};

export default RoomOptionsMenu;
