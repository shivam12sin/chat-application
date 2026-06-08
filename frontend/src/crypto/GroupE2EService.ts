/**
 * Group E2E Encryption Service
 * 
 * Manages end-to-end encryption for group chats using Sender Keys protocol.
 * Each sender in a group maintains their own Sender Key, which they distribute
 * to other group members.
 */

import {
    generateSenderKeyState,
    createDistributionMessage,
    parseDistributionMessage,
    senderKeyEncrypt,
    senderKeyDecrypt,
    serializeSenderKeyState,
    deserializeSenderKeyState,
    serializeSenderKeyRecord,
    deserializeSenderKeyRecord,
    type SenderKeyState,
    type SenderKeyRecord,
    type SenderKeyDistributionMessage,
    type GroupEncryptedMessage,
} from './senderKeys';

import { e2eCryptoService } from './E2ECryptoService';
import axios from 'axios';

// ============================================
// TYPES
// ============================================

export interface GroupE2EConfig {
    apiUrl: string;
    token: string;
    userId: number;
}

export interface GroupMember {
    userId: number;
    username: string;
    hasE2E: boolean;
}

export interface GroupEncryptedPayload {
    version: number;
    type: 'sender-key';
    senderId: number;
    roomId: string;
    senderKeyId: number;
    message: GroupEncryptedMessage;
    isGroupE2E: true;
}

export interface RoomE2EState {
    roomId: string;
    isInitialized: boolean;
    members: number[];
    ownSenderKeyId?: number;
    hasSenderKey: boolean;
}

// ============================================
// STORAGE KEYS
// ============================================

const SENDER_KEY_STATE_PREFIX = 'group_sender_key_';
const SENDER_KEY_RECORD_PREFIX = 'group_receiver_key_';
const ROOM_MEMBERS_PREFIX = 'group_members_';

// ============================================
// GROUP E2E SERVICE CLASS
// ============================================

class GroupE2EService {
    private config: GroupE2EConfig | null = null;
    
    // My Sender Key states per group (using string roomId for flexibility)
    private senderKeyStates: Map<string, SenderKeyState> = new Map();
    
    // Received Sender Keys from other members: Map<roomId, Map<senderId, SenderKeyRecord>>
    private receivedSenderKeys: Map<string, Map<number, SenderKeyRecord>> = new Map();
    
    // Room members cache
    private roomMembers: Map<string, number[]> = new Map();
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    /**
     * Initialize the group E2E service
     */
    async initialize(config: GroupE2EConfig): Promise<void> {
        this.config = config;
        
        // Load stored sender key states from localStorage
        await this.loadStoredKeys();
    }
    
    /**
     * Load stored keys from localStorage
     */
    private async loadStoredKeys(): Promise<void> {
        if (!this.config) return;
        
        // Load my sender key states
        const stateKeys = Object.keys(localStorage).filter(k => 
            k.startsWith(`${SENDER_KEY_STATE_PREFIX}${this.config!.userId}_`)
        );
        
        for (const key of stateKeys) {
            try {
                const roomId = key.split('_').pop()!;
                const stateJson = localStorage.getItem(key);
                if (stateJson) {
                    this.senderKeyStates.set(roomId, deserializeSenderKeyState(stateJson));
                }
            } catch (error) {
                console.error('Failed to load sender key state:', error);
            }
        }
        
        // Load received sender keys
        const recordKeys = Object.keys(localStorage).filter(k => 
            k.startsWith(SENDER_KEY_RECORD_PREFIX)
        );
        
        for (const key of recordKeys) {
            try {
                const parts = key.replace(SENDER_KEY_RECORD_PREFIX, '').split('_');
                const roomId = parts[0];
                const senderId = parseInt(parts[1], 10);
                
                const recordJson = localStorage.getItem(key);
                if (recordJson) {
                    if (!this.receivedSenderKeys.has(roomId)) {
                        this.receivedSenderKeys.set(roomId, new Map());
                    }
                    this.receivedSenderKeys.get(roomId)!.set(
                        senderId,
                        deserializeSenderKeyRecord(recordJson)
                    );
                }
            } catch (error) {
                console.error('Failed to load sender key record:', error);
            }
        }
        
        // Load room members
        const memberKeys = Object.keys(localStorage).filter(k =>
            k.startsWith(ROOM_MEMBERS_PREFIX)
        );
        
        for (const key of memberKeys) {
            try {
                const roomId = key.replace(ROOM_MEMBERS_PREFIX, '');
                const membersJson = localStorage.getItem(key);
                if (membersJson) {
                    this.roomMembers.set(roomId, JSON.parse(membersJson));
                }
            } catch (error) {
                console.error('Failed to load room members:', error);
            }
        }
    }
    
    /**
     * Save sender key state to localStorage
     */
    private saveSenderKeyState(roomId: string): void {
        if (!this.config) return;
        
        const state = this.senderKeyStates.get(roomId);
        if (state) {
            const key = `${SENDER_KEY_STATE_PREFIX}${this.config.userId}_${roomId}`;
            localStorage.setItem(key, serializeSenderKeyState(state));
        }
    }
    
    /**
     * Save received sender key to localStorage
     */
    private saveSenderKeyRecord(roomId: string, senderId: number): void {
        const roomKeys = this.receivedSenderKeys.get(roomId);
        if (roomKeys) {
            const record = roomKeys.get(senderId);
            if (record) {
                const key = `${SENDER_KEY_RECORD_PREFIX}${roomId}_${senderId}`;
                localStorage.setItem(key, serializeSenderKeyRecord(record));
            }
        }
    }
    
    /**
     * Save room members to localStorage
     */
    private saveRoomMembers(roomId: string): void {
        const members = this.roomMembers.get(roomId);
        if (members) {
            const key = `${ROOM_MEMBERS_PREFIX}${roomId}`;
            localStorage.setItem(key, JSON.stringify(members));
        }
    }
    
    // ============================================
    // ROOM STATE (for e2eMessageService integration)
    // ============================================
    
    /**
     * Get the E2E state for a room
     */
    getRoomState(roomId: string): RoomE2EState | null {
        const state = this.senderKeyStates.get(roomId);
        const members = this.roomMembers.get(roomId) || [];
        
        if (!state && members.length === 0) {
            return null;
        }
        
        return {
            roomId,
            isInitialized: !!state,
            members,
            ownSenderKeyId: state?.keyId,
            hasSenderKey: !!state,
        };
    }
    
    /**
     * Initialize E2E for a room with given members
     */
    async initializeForRoom(roomId: string, memberUserIds: number[]): Promise<void> {
        if (!this.config) throw new Error('Service not initialized');
        
        // Store members
        this.roomMembers.set(roomId, memberUserIds);
        this.saveRoomMembers(roomId);
        
        // Generate sender key
        await this.getOrCreateSenderKey(roomId);
        
        // Distribute to members
        await this.distributeSenderKey(roomId, memberUserIds);
    }
    
    // ============================================
    // SENDER KEY MANAGEMENT
    // ============================================
    
    /**
     * Get or create a sender key for a group
     */
    async getOrCreateSenderKey(roomId: string): Promise<SenderKeyState> {
        if (!this.config) throw new Error('Service not initialized');
        
        let state = this.senderKeyStates.get(roomId);
        
        if (!state) {
            // Generate new sender key
            state = await generateSenderKeyState();
            this.senderKeyStates.set(roomId, state);
            this.saveSenderKeyState(roomId);
        }
        
        return state;
    }
    
    /**
     * Distribute my sender key to all group members
     */
    async distributeSenderKey(roomId: string, memberUserIds: number[]): Promise<void> {
        if (!this.config) throw new Error('Service not initialized');
        
        const state = await this.getOrCreateSenderKey(roomId);
        const distribution = createDistributionMessage(state);
        const roomIdNum = parseInt(roomId, 10);
        
        // Encrypt distribution message for each member using pairwise E2E
        // This ensures only group members can receive the sender key
        for (const memberId of memberUserIds) {
            if (memberId === this.config.userId) continue;
            
            try {
                // Send via pairwise encryption
                const encryptedDist = await e2eCryptoService.encryptMessage(
                    memberId,
                    JSON.stringify(distribution),
                    roomIdNum
                );
                
                // Upload to server for delivery
                await axios.post(
                    `${this.config.apiUrl}/e2e/sender-keys`,
                    {
                        roomId: roomIdNum,
                        recipientId: memberId,
                        distribution: encryptedDist,
                    },
                    {
                        headers: { Authorization: `Bearer ${this.config.token}` },
                    }
                );
            } catch (error) {
                console.error(`Failed to distribute sender key to user ${memberId}:`, error);
            }
        }
    }
    
    /**
     * Process a received sender key distribution
     */
    async processSenderKeyDistribution(
        roomId: string,
        senderId: number,
        encryptedDistribution: any
    ): Promise<void> {
        if (!this.config) throw new Error('Service not initialized');
        
        try {
            const roomIdNum = parseInt(roomId, 10);
            
            // Decrypt the distribution message
            const distributionJson = await e2eCryptoService.decryptMessage(
                senderId,
                encryptedDistribution,
                roomIdNum
            );
            
            const distribution: SenderKeyDistributionMessage = JSON.parse(distributionJson);
            const record = parseDistributionMessage(distribution);
            
            // Store the sender key
            if (!this.receivedSenderKeys.has(roomId)) {
                this.receivedSenderKeys.set(roomId, new Map());
            }
            this.receivedSenderKeys.get(roomId)!.set(senderId, record);
            this.saveSenderKeyRecord(roomId, senderId);
            
            console.log(`Received sender key from user ${senderId} for room ${roomId}`);
        } catch (error) {
            console.error('Failed to process sender key distribution:', error);
            throw error;
        }
    }
    
    /**
     * Rotate my sender key for a group (after member removal)
     */
    async rotateSenderKey(roomId: string, remainingMemberIds: number[]): Promise<void> {
        if (!this.config) throw new Error('Service not initialized');
        
        // Generate new sender key
        const newState = await generateSenderKeyState();
        this.senderKeyStates.set(roomId, newState);
        this.saveSenderKeyState(roomId);
        
        // Update members
        this.roomMembers.set(roomId, remainingMemberIds);
        this.saveRoomMembers(roomId);
        
        // Distribute to remaining members
        await this.distributeSenderKey(roomId, remainingMemberIds);
    }
    
    // ============================================
    // ENCRYPTION / DECRYPTION
    // ============================================
    
    /**
     * Encrypt a message for a group (alias for encryptForGroup)
     */
    async encrypt(roomId: string, plaintext: string): Promise<GroupEncryptedPayload> {
        return this.encryptForGroup(roomId, plaintext);
    }
    
    /**
     * Encrypt a message for a group
     */
    async encryptForGroup(roomId: string, plaintext: string): Promise<GroupEncryptedPayload> {
        if (!this.config) throw new Error('Service not initialized');
        
        const state = await this.getOrCreateSenderKey(roomId);
        const plaintextBytes = new TextEncoder().encode(plaintext);
        
        const encrypted = await senderKeyEncrypt(state, plaintextBytes);
        this.saveSenderKeyState(roomId);  // Save updated chain state
        
        return {
            version: 1,
            type: 'sender-key',
            senderId: this.config.userId,
            roomId,
            senderKeyId: state.keyId,
            message: encrypted,
            isGroupE2E: true,
        };
    }
    
    /**
     * Decrypt a message from a group (alias for decryptFromGroup)
     */
    async decrypt(payload: GroupEncryptedPayload): Promise<string> {
        return this.decryptFromGroup(payload.roomId, payload.senderId, payload);
    }
    
    /**
     * Decrypt a message from a group
     */
    async decryptFromGroup(
        roomId: string,
        senderId: number,
        payload: GroupEncryptedPayload
    ): Promise<string> {
        if (!this.config) throw new Error('Service not initialized');
        
        const { message } = payload;
        
        // Get sender's key record
        const roomKeys = this.receivedSenderKeys.get(roomId);
        if (!roomKeys) {
            throw new Error(`No sender keys for room ${roomId}`);
        }
        
        const record = roomKeys.get(senderId);
        if (!record) {
            throw new Error(`No sender key from user ${senderId}`);
        }
        
        const plaintextBytes = await senderKeyDecrypt(record, message);
        this.saveSenderKeyRecord(roomId, senderId);  // Save updated chain state
        
        return new TextDecoder().decode(plaintextBytes);
    }
    
    // ============================================
    // GROUP MEMBERSHIP CHANGES
    // ============================================
    
    /**
     * Handle a new member joining the group
     */
    async handleMemberJoined(roomId: string, newMemberId: number): Promise<void> {
        if (!this.config) throw new Error('Service not initialized');
        
        // Add to members
        const members = this.roomMembers.get(roomId) || [];
        if (!members.includes(newMemberId)) {
            members.push(newMemberId);
            this.roomMembers.set(roomId, members);
            this.saveRoomMembers(roomId);
        }
        
        // Distribute my sender key to the new member
        await this.distributeSenderKey(roomId, [newMemberId]);
    }
    
    /**
     * Handle a member leaving the group
     */
    async handleMemberLeft(roomId: string, leftMemberId: number): Promise<void> {
        if (!this.config) throw new Error('Service not initialized');
        
        // Remove from members
        const members = this.roomMembers.get(roomId) || [];
        const remainingMemberIds = members.filter(id => id !== leftMemberId);
        this.roomMembers.set(roomId, remainingMemberIds);
        this.saveRoomMembers(roomId);
        
        // Remove their sender key
        const roomKeys = this.receivedSenderKeys.get(roomId);
        if (roomKeys) {
            roomKeys.delete(leftMemberId);
            const key = `${SENDER_KEY_RECORD_PREFIX}${roomId}_${leftMemberId}`;
            localStorage.removeItem(key);
        }
        
        // Rotate my sender key so the departed member can't decrypt future messages
        await this.rotateSenderKey(roomId, remainingMemberIds);
    }
    
    /**
     * Handle being removed from a group or leaving
     */
    handleLeftGroup(roomId: string): void {
        // Clear my sender key for this group
        this.senderKeyStates.delete(roomId);
        if (this.config) {
            const stateKey = `${SENDER_KEY_STATE_PREFIX}${this.config.userId}_${roomId}`;
            localStorage.removeItem(stateKey);
        }
        
        // Clear received sender keys
        this.receivedSenderKeys.delete(roomId);
        const recordKeys = Object.keys(localStorage).filter(k => 
            k.startsWith(`${SENDER_KEY_RECORD_PREFIX}${roomId}_`)
        );
        recordKeys.forEach(k => localStorage.removeItem(k));
        
        // Clear members
        this.roomMembers.delete(roomId);
        localStorage.removeItem(`${ROOM_MEMBERS_PREFIX}${roomId}`);
    }
    
    // ============================================
    // STATUS
    // ============================================
    
    /**
     * Check if we have all sender keys for a group
     */
    hasAllSenderKeys(roomId: string, memberIds: number[]): boolean {
        if (!this.config) return false;
        
        const roomKeys = this.receivedSenderKeys.get(roomId);
        if (!roomKeys) return false;
        
        for (const memberId of memberIds) {
            if (memberId === this.config.userId) continue;
            if (!roomKeys.has(memberId)) return false;
        }
        
        return true;
    }
    
    /**
     * Get missing sender key member IDs
     */
    getMissingSenderKeyMembers(roomId: string, memberIds: number[]): number[] {
        if (!this.config) return memberIds;
        
        const roomKeys = this.receivedSenderKeys.get(roomId);
        if (!roomKeys) {
            return memberIds.filter(id => id !== this.config!.userId);
        }
        
        return memberIds.filter(id => 
            id !== this.config!.userId && !roomKeys.has(id)
        );
    }
    
    /**
     * Check if group E2E is available
     */
    isGroupE2EAvailable(roomId: string, memberIds: number[]): boolean {
        if (!e2eCryptoService.isEnabled()) return false;
        return this.senderKeyStates.has(roomId) && this.hasAllSenderKeys(roomId, memberIds);
    }
    
    /**
     * Check if initialized
     */
    isInitialized(): boolean {
        return this.config !== null;
    }
}

// Export singleton instance
export const groupE2EService = new GroupE2EService();
export default GroupE2EService;
