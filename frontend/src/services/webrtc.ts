import { Socket } from 'socket.io-client';

export interface CallConfig {
    iceServers: RTCIceServer[];
}

export type CallEvent = 'localStream' | 'remoteStream' | 'connectionState' | 'error' | 'peerJoined' | 'peerLeft';
export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

type EventHandler = (data: any) => void;

class WebRTCService {
    // Map<userId, RTCPeerConnection>
    private peers: Map<number, RTCPeerConnection> = new Map();
    private localStream: MediaStream | null = null;
    private socket: Socket | null = null;
    private currentRoomId: number | null = null; // For group call context
    private eventListeners: Map<CallEvent, EventHandler[]> = new Map();

    // SECURITY: ICE servers configuration - TURN credentials from env only
    private config: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // TURN server only if credentials are configured via env
            ...(import.meta.env.VITE_TURN_URL ? [{
                urls: import.meta.env.VITE_TURN_URL,
                username: import.meta.env.VITE_TURN_USERNAME || '',
                credential: import.meta.env.VITE_TURN_PASSWORD || ''
            }] : [])
        ]
    };

    initialize(socket: Socket) {
        this.socket = socket;
        this.setupSocketListeners();
    }

    on(event: CallEvent, handler: EventHandler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)?.push(handler);
    }

    off(event: CallEvent, handler: EventHandler) {
        const handlers = this.eventListeners.get(event);
        if (handlers) {
            this.eventListeners.set(event, handlers.filter(h => h !== handler));
        }
    }

    private emit(event: CallEvent, data: any) {
        this.eventListeners.get(event)?.forEach(handler => handler(data));
    }

    // 1:1 Call Entry Point
    async startCall(targetUserId: number, video: boolean = false): Promise<MediaStream> {
        // Start Local Stream
        const stream = await this.getLocalStream(video);

        // Connect to single peer
        await this.connectToPeer(targetUserId, true); // true = initiator

        return stream;
    }

    // Group Call Entry Point
    async joinGroupCall(roomId: number, video: boolean = false): Promise<MediaStream> {
        this.currentRoomId = roomId;
        const stream = await this.getLocalStream(video);

        // Tell backend we want to join
        this.socket?.emit('call:join_group', { roomId });

        return stream;
    }

    // Connect to a specific peer (used for both 1:1 and Mesh)
    private async connectToPeer(userId: number, initiator: boolean = false) {
        if (this.peers.has(userId)) return this.peers.get(userId);

        const pc = new RTCPeerConnection(this.config);
        this.peers.set(userId, pc);

        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream!);
            });
        }

        // ICE Candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket?.emit('call:signal', {
                    targetUserId: userId,
                    type: 'ice-candidate',
                    payload: event.candidate
                });
            }
        };

        // Remote Stream
        pc.ontrack = (event) => {
            this.emit('remoteStream', {
                userId,
                stream: event.streams[0]
            });
        };

        // Connection State
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            // We could emit specific peer state: this.emit('peerState', { userId, state });
            // For 1:1 backward comp, we emit general state if it's the only peer?
            if (this.peers.size === 1) {
                this.emit('connectionState', state);
            }

            if (state === 'failed') {
                console.log(`Connection failed for peer ${userId}, restarting ICE...`);
                this.restartIce(userId);
            }
        };

        if (initiator) {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                this.socket?.emit('call:signal', {
                    targetUserId: userId,
                    type: 'offer',
                    payload: offer
                });
            } catch (err) {
                console.error(`Error creating offer for ${userId}:`, err);
            }
        }

        return pc;
    }

    async inviteUser(roomId: number, targetUserId: number) {
        this.socket?.emit('call:invite', { roomId, targetUserId });
    }

    async handleIncomingCall(callerId: number, offer: RTCSessionDescriptionInit, video: boolean = false): Promise<MediaStream> {
        const stream = await this.getLocalStream(video);

        // This creates PC and handles answer
        await this.handleOffer(callerId, offer);

        return stream;
    }

    private async handleOffer(senderId: number, offer: RTCSessionDescriptionInit) {
        const pc = await this.connectToPeer(senderId, false); // false = not initiator

        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket?.emit('call:signal', {
            targetUserId: senderId,
            type: 'answer',
            payload: answer
        });
    }

    async endCall() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
            });
            this.localStream = null;
        }

        this.peers.forEach(pc => pc.close());
        this.peers.clear();

        if (this.currentRoomId) {
            this.socket?.emit('call:leave_group', { roomId: this.currentRoomId });
            this.currentRoomId = null;
        }

        this.emit('connectionState', 'closed');
    }

    async toggleMute(enabled: boolean) {
        if (enabled) {
            // Unmute
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const newTrack = stream.getAudioTracks()[0];

                // Replace track for ALL peers
                this.peers.forEach(async (pc) => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
                    if (sender) await sender.replaceTrack(newTrack);
                });

                // Update local stream
                if (this.localStream) {
                    const oldTrack = this.localStream.getAudioTracks()[0];
                    if (oldTrack) {
                        this.localStream.removeTrack(oldTrack);
                        oldTrack.stop();
                    }
                    this.localStream.addTrack(newTrack);
                } else {
                    this.localStream = stream;
                    this.emit('localStream', stream);
                }

            } catch (err) {
                console.error('Unmute failed', err);
            }
        } else {
            // Mute
            if (this.localStream) {
                this.localStream.getAudioTracks().forEach(t => t.stop());
                // Optional: replaceSender with null? user preference.
            }
        }
    }

    async toggleVideo(enabled: boolean) {
        if (!this.localStream) return;
        const videoTrack = this.localStream.getVideoTracks()[0];

        if (enabled) {
            if (videoTrack) {
                videoTrack.enabled = true;
            } else {
                try {
                    const videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                    const newTrack = videoStream.getVideoTracks()[0];
                    this.localStream.addTrack(newTrack);

                    // Add track to all peers & renegotiate
                    this.peers.forEach(async (pc, userId) => {
                        pc.addTrack(newTrack, this.localStream!);
                        // Renegotiate
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        this.socket?.emit('call:signal', {
                            targetUserId: userId,
                            type: 'offer',
                            payload: offer
                        });
                    });

                } catch (err) {
                    console.error('Enable video failed', err);
                }
            }
        } else {
            if (videoTrack) {
                videoTrack.enabled = false;
                videoTrack.stop();
                this.localStream.removeTrack(videoTrack);

                this.peers.forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) pc.removeTrack(sender);
                    // Note: Removing track usually requires re-negotiation or the other side just actively sees 'ended'
                });
            }
        }
    }

    async startScreenShare(): Promise<void> {
        if (!this.localStream) return;
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const screenTrack = screenStream.getVideoTracks()[0];

            // Replace for ALL peers
            this.peers.forEach(async (pc) => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(screenTrack);
            });

            const oldTrack = this.localStream.getVideoTracks()[0];
            if (oldTrack) {
                oldTrack.enabled = false;
                oldTrack.stop();
                this.localStream.removeTrack(oldTrack);
            }
            this.localStream.addTrack(screenTrack);
            this.emit('localStream', this.localStream);

            screenTrack.onended = () => this.stopScreenShare();

        } catch (err) {
            console.error('Start screen share failed', err);
        }
    }

    async stopScreenShare(): Promise<void> {
        if (!this.localStream) return;
        const screenTrack = this.localStream.getVideoTracks()[0];
        if (screenTrack) {
            screenTrack.stop();
            this.localStream.removeTrack(screenTrack);
        }

        try {
            const userStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            const videoTrack = userStream.getVideoTracks()[0];
            this.localStream.addTrack(videoTrack);
            this.emit('localStream', this.localStream);

            this.peers.forEach(async (pc) => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(videoTrack);
            });

        } catch (err) {
            console.error('Stop screen share failed', err);
        }
    }

    async restartIce(targetUserId?: number) {
        // If single user and no target specified, use the only one?
        // for now require targetUserId
        if (!targetUserId && this.peers.size === 1) {
            targetUserId = this.peers.keys().next().value;
        }

        if (targetUserId && this.peers.has(targetUserId)) {
            const pc = this.peers.get(targetUserId)!;
            try {
                const offer = await pc.createOffer({ iceRestart: true });
                await pc.setLocalDescription(offer);
                this.socket?.emit('call:signal', {
                    targetUserId,
                    type: 'offer',
                    payload: offer
                });
            } catch (e) {
                console.error('ICE restart failed', e);
            }
        }
    }

    // Stub for connection quality
    async getConnectionQuality(): Promise<'good' | 'fair' | 'poor' | 'unknown'> {
        // Just check the first peer for now
        if (this.peers.size === 0) return 'unknown';
        const firstPc = this.peers.values().next().value;
        if (!firstPc) return 'unknown';

        try {
            const stats = await firstPc.getStats();
            let rtt = 0;
            let found = false;
            stats.forEach((report: any) => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime) {
                    rtt = report.currentRoundTripTime * 1000;
                    found = true;
                }
            });
            if (!found) return 'unknown';
            if (rtt < 100) return 'good';
            if (rtt < 300) return 'fair';
            return 'poor';
        } catch { return 'unknown'; }
    }

    private async setupSocketListeners() {
        if (!this.socket) return;

        this.socket.on('call:signal', async (data: { senderId: number; type: string; payload: any }) => {
            const { senderId, type, payload } = data;

            // If we don't have a PC for this sender, and it's an OFFER, accept it
            if (!this.peers.has(senderId)) {
                if (type === 'offer') {
                    await this.handleOffer(senderId, payload);
                }
            } else {
                // Existing peer
                const pc = this.peers.get(senderId)!;
                if (type === 'answer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload));
                } else if (type === 'ice-candidate') {
                    if (payload) await pc.addIceCandidate(new RTCIceCandidate(payload));
                } else if (type === 'offer') {
                    // Renegotiation?
                    await pc.setRemoteDescription(new RTCSessionDescription(payload));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    this.socket?.emit('call:signal', {
                        targetUserId: senderId,
                        type: 'answer',
                        payload: answer
                    });
                }
            }
        });

        // Group Call: New Peer Joined
        this.socket.on('call:new_peer', async (data: { userId: number, username: string }) => {
            console.log('New peer joined group call:', data.username);
            this.emit('peerJoined', data);
            // Passive: We wait for their offer
        });

        // Group Call: Peer Left
        this.socket.on('call:peer_left', (data: { userId: number }) => {
            console.log('Peer left group call:', data.userId);
            if (this.peers.has(data.userId)) {
                this.peers.get(data.userId)?.close();
                this.peers.delete(data.userId);
                this.emit('peerLeft', { userId: data.userId });
            }
        });

        // Group Call: Joined Room (List of current participants)
        this.socket.on('call:room_joined', (data: { roomId: number, participants: { userId: number }[] }) => {
            // We need to connect to all existing participants
            // Usually, new joiner initiates to existing? or vice versa?
            // To avoid collision, we can say: "New Joiner Initiates to All Existing"
            // My implementation of connectToPeer(..., true) does exactly that.
            data.participants.forEach(p => {
                this.connectToPeer(p.userId, true);
            });
        });

        this.socket.on('call:error', (data: { message: string }) => {
            console.error('Call error:', data.message);
            this.emit('error', data.message);
        });
    }

    private async getLocalStream(video: boolean): Promise<MediaStream> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: video ? { facingMode: 'user' } : false
            });

            this.localStream = stream;
            this.emit('localStream', stream);
            return stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }
}

export default new WebRTCService();
