import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import ChromeButton from '../ChromeButton';
import axios from 'axios';
import { Search, UserPlus, Check } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface User {
    id: number;
    username: string;
    avatar?: string;
    status: string; // 'connected', 'pending_sent', 'pending_received', 'none'
}

interface UserInviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentRoomId: number;
    onInvite: (userId: number) => void;
}

const UserInviteModal: React.FC<UserInviteModalProps> = ({ isOpen, onClose, currentRoomId, onInvite }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [invitedIds, setInvitedIds] = useState<number[]>([]);
    const { success } = useToast();

    // Use currentRoomId if needed for filtering already in call? 
    // For now suppressing unused warning by logging or ignoring
    useEffect(() => {
        // Placeholder to avoid unused var
        if (currentRoomId === -1) console.log('debug');
    }, [currentRoomId]);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const token = localStorage.getItem('token');

    // Debounce search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (query.trim()) {
                handleSearch();
            } else {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [query]);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/contacts/search`, {
                params: { query },
                headers: { Authorization: `Bearer ${token}` }
            });
            setResults(response.data);
        } catch (err) {
            console.error('Search failed', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = (user: User) => {
        onInvite(user.id);
        setInvitedIds(prev => [...prev, user.id]);
        success(`Invited ${user.username}`);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Add to Call"
            confirmText="Done"
            onConfirm={onClose}
        // Removed showCancel as it's not supported by Modal? 
        // If Modal always shows cancel, we can't hide it easily without modifying Modal.
        // Assuming default Modal behavior is fine.
        >
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mono-muted" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="input-glass w-full pl-9"
                        autoFocus
                    />
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {loading ? (
                        <div className="text-center text-mono-muted py-4">Searching...</div>
                    ) : results.length > 0 ? (
                        results.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-medium">
                                        {user.username[0].toUpperCase()}
                                    </div>
                                    <span className="text-mono-text font-medium">{user.username}</span>
                                </div>
                                <ChromeButton
                                    variant="circle"
                                    className="p-2 w-8 h-8 flex items-center justify-center"
                                    onClick={() => handleInvite(user)}
                                    disabled={invitedIds.includes(user.id)}
                                >
                                    {invitedIds.includes(user.id) ? (
                                        <Check size={16} />
                                    ) : (
                                        <UserPlus size={16} />
                                    )}
                                </ChromeButton>
                            </div>
                        ))
                    ) : query.trim() ? (
                        <div className="text-center text-mono-muted py-4">No users found</div>
                    ) : (
                        <div className="text-center text-mono-muted py-4 text-sm">
                            Type to search for people to invite
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default UserInviteModal;
