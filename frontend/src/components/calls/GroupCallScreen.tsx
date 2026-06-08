import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, Users, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import webrtcService from '../../services/webrtc';
import UserInviteModal from './UserInviteModal';
import { useToast } from '../../hooks/useToast';

interface Participant {
    userId: number;
    username?: string;
    stream?: MediaStream;
}

interface GroupCallScreenProps {
    roomId: number;
    localStream: MediaStream | null;
    callType: 'voice' | 'video';
    onEndCall: () => void;
}

const GroupCallScreen: React.FC<GroupCallScreenProps> = ({
    roomId,
    localStream,
    callType,
    onEndCall
}) => {
    const [participants, setParticipants] = useState<Map<number, Participant>>(new Map());
    const [muted, setMuted] = useState(false);
    const [cameraOff, setCameraOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [dStatus, setDStatus] = useState('Connecting...');
    const { } = useToast();

    // Local Video Ref
    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Refs for remote videos are tricky in a dynamic list.
    // We can use a callback ref or a Map of refs, but React handles auto-play on mount usually?
    // Actually, we need to assign srcObject.

    // We'll update the participants map when streams arrive
    useEffect(() => {
        const handleRemoteStream = ({ userId, stream }: { userId: number, stream: MediaStream }) => {
            console.log(`Received stream from ${userId}`);
            setParticipants(prev => {
                const newMap = new Map(prev);
                const p = newMap.get(userId) || { userId };
                newMap.set(userId, { ...p, stream });
                return newMap;
            });
            setDStatus('Connected');
        };

        const handlePeerJoined = ({ userId, username }: { userId: number, username: string }) => {
            console.log(`Peer joined: ${username} (${userId})`);
            setParticipants(prev => {
                const newMap = new Map(prev);
                if (!newMap.has(userId)) {
                    newMap.set(userId, { userId, username });
                }
                return newMap;
            });
        };

        const handlePeerLeft = ({ userId }: { userId: number }) => {
            console.log(`Peer left: ${userId}`);
            setParticipants(prev => {
                const newMap = new Map(prev);
                newMap.delete(userId);
                return newMap;
            });
        };

        const handleState = (state: string) => {
            setDStatus(state);
        };

        webrtcService.on('remoteStream', handleRemoteStream);
        webrtcService.on('peerJoined', handlePeerJoined);
        webrtcService.on('peerLeft', handlePeerLeft);
        webrtcService.on('connectionState', handleState);

        return () => {
            webrtcService.off('remoteStream', handleRemoteStream);
            webrtcService.off('peerJoined', handlePeerJoined);
            webrtcService.off('peerLeft', handlePeerLeft);
            webrtcService.off('connectionState', handleState);
        };
    }, []);

    // Update local video
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    const toggleMute = () => {
        webrtcService.toggleMute(!muted);
        setMuted(!muted);
    };

    const toggleCamera = () => {
        webrtcService.toggleVideo(cameraOff);
        setCameraOff(!cameraOff);
    };

    const toggleScreenShare = async () => {
        if (!isScreenSharing) {
            await webrtcService.startScreenShare();
            setIsScreenSharing(true);
            setCameraOff(true);
        } else {
            await webrtcService.stopScreenShare();
            setIsScreenSharing(false);
            setCameraOff(false);
        }
    };

    const handleInviteUser = (userId: number) => {
        webrtcService.inviteUser(roomId, userId);
    };



    // Calculate Grid
    const getGridClass = (count: number) => {
        if (count <= 1) return 'grid-cols-1';
        if (count === 2) return 'grid-cols-1 md:grid-cols-2';
        return 'grid-cols-2';
    };

    const participantList = Array.from(participants.values());
    const totalCount = participantList.length + 1; // +1 for local

    return (
        <div className="fixed inset-0 z-[70] bg-zinc-950 flex flex-col overflow-hidden">
            {/* Header / Info */}
            <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
                <div className="px-3 py-1 bg-black/40 backdrop-blur rounded text-xs text-zinc-400 font-mono border border-white/5 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dStatus === 'Connected' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    {dStatus.toUpperCase()} • ROOM: {roomId}
                </div>
            </div>

            {/* Header Right: Add User & Link */}
            <div className="absolute top-6 right-6 z-10 flex gap-2">

                <button
                    onClick={() => setIsInviteModalOpen(true)}
                    className="p-2 rounded-full bg-black/40 backdrop-blur border border-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <UserPlus size={20} />
                </button>
            </div>

            {/* Grid Container */}
            <div className={`flex-1 grid ${getGridClass(totalCount)} gap-4 p-4 md:p-8 overflow-y-auto`}>

                {/* Local User */}
                <div className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-lg min-h-[200px]">
                    {localStream && (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover ${cameraOff && !isScreenSharing ? 'hidden' : ''}`}
                        />
                    )}

                    {cameraOff && (
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                            <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center">
                                <VideoOff size={32} />
                            </div>
                        </div>
                    )}

                    <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs font-medium text-white backdrop-blur-md">
                        You {muted && '(Muted)'}
                    </div>
                </div>

                {/* Remote Participants */}
                {participantList.map(p => (
                    <div key={p.userId} className="relative bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-lg min-h-[200px]">
                        {p.stream ? (
                            <VideoComponent stream={p.stream} />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 animate-pulse">
                                <Users size={40} />
                                <span className="text-sm">Connecting...</span>
                            </div>
                        )}
                        <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs font-medium text-white backdrop-blur-md">
                            {p.username || `User ${p.userId}`}
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="p-8 flex justify-center w-full z-20">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="px-6 py-4 bg-zinc-900/80 backdrop-blur-xl rounded-full border border-white/10 flex items-center gap-4 shadow-2xl"
                >
                    <button
                        onClick={toggleMute}
                        className={`p-4 rounded-full transition-all ${muted ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                        {muted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>

                    <button
                        onClick={toggleCamera}
                        disabled={isScreenSharing}
                        className={`p-4 rounded-full transition-all ${cameraOff ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'} ${isScreenSharing ? 'opacity-50' : ''}`}
                    >
                        {cameraOff ? <VideoOff size={24} /> : <Video size={24} />}
                    </button>

                    {callType === 'video' && (
                        <button
                            onClick={toggleScreenShare}
                            className={`p-4 rounded-full transition-all ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        >
                            {isScreenSharing ? <MonitorOff size={24} /> : <Monitor size={24} />}
                        </button>
                    )}

                    <div className="w-px h-8 bg-white/20 mx-2" />

                    <button
                        onClick={onEndCall}
                        className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all transform hover:scale-105"
                    >
                        <PhoneOff size={24} />
                    </button>
                </motion.div>
            </div>

            <UserInviteModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                currentRoomId={roomId}
                onInvite={handleInviteUser}
            />
        </div>
    );
};

// Sub-component to handle video ref lifecycle per participant
const VideoComponent = ({ stream }: { stream: MediaStream }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
        />
    );
};

export default GroupCallScreen;
