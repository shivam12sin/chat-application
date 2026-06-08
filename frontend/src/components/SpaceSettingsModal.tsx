import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Settings, Clock, UserPlus, LogOut, Search } from 'lucide-react';
import { cn, SPACE_TONES } from '../utils/theme';
import ChromeButton from './ChromeButton';
import Avatar from './Avatar';
import socketService from '../services/socket';
import { useToast } from '../hooks/useToast';
import axios from 'axios';

interface SpaceMember {
    user_id: number;
    username: string;
    display_name?: string;
    avatar_url?: string;
    role: string;
    alias?: string;
}

interface SpaceSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    space: {
        id: number;
        name: string;
        description?: string;
        tone?: string;
        settings?: { quietHours?: { start: string; end: string } };
    };
    currentUserId: number;
    onSpaceUpdated?: (space: any) => void;
    onSpaceLeft?: () => void;
}

const TABS = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'quiet', label: 'Quiet Hours', icon: Clock },
];

const SpaceSettingsModal: React.FC<SpaceSettingsModalProps> = ({
    isOpen,
    onClose,
    space,
    currentUserId: _currentUserId,
    onSpaceUpdated,
    onSpaceLeft,
}) => {
    const [activeTab, setActiveTab] = useState('general');
    const [name, setName] = useState(space.name);
    const [description, setDescription] = useState(space.description || '');
    const [tone, setTone] = useState(space.tone || 'social');
    const [members, setMembers] = useState<SpaceMember[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [quietStart, setQuietStart] = useState(space.settings?.quietHours?.start || '22:00');
    const [quietEnd, setQuietEnd] = useState(space.settings?.quietHours?.end || '08:00');
    const [myAlias, setMyAlias] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setName(space.name);
            setDescription(space.description || '');
            setTone(space.tone || 'social');
            setQuietStart(space.settings?.quietHours?.start || '22:00');
            setQuietEnd(space.settings?.quietHours?.end || '08:00');
            loadMembers();
        }
    }, [isOpen, space]);

    const loadMembers = () => {
        socketService.getSpaceMembers(space.id, (response) => {
            if (response.members) {
                setMembers(response.members);
            }
        });
    };

    const handleSaveGeneral = () => {
        setIsLoading(true);
        socketService.updateSpace(space.id, { name, description, tone }, (response) => {
            setIsLoading(false);
            if (response.error) {
                addToast(response.error, 'error');
            } else {
                addToast('Space updated', 'success');
                onSpaceUpdated?.(response.space);
            }
        });
    };

    const handleSaveQuietHours = () => {
        setIsLoading(true);
        socketService.updateSpace(
            space.id,
            { settings: { quietHours: { start: quietStart, end: quietEnd } } },
            (response) => {
                setIsLoading(false);
                if (response.error) {
                    addToast(response.error, 'error');
                } else {
                    addToast('Quiet hours updated', 'success');
                    onSpaceUpdated?.(response.space);
                }
            }
        );
    };

    const handleSearchUsers = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/users/search?q=${encodeURIComponent(searchQuery)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const existingIds = members.map(m => m.user_id);
            setSearchResults(res.data.filter((u: any) => !existingIds.includes(u.id)));
        } catch {
            addToast('Search failed', 'error');
        } finally {
            setIsSearching(false);
        }
    };

    const handleInvite = (userId: number) => {
        socketService.inviteToSpace(space.id, userId, (response) => {
            if (response.error) {
                addToast(response.error, 'error');
            } else {
                addToast('User invited', 'success');
                loadMembers();
                setSearchResults(prev => prev.filter(u => u.id !== userId));
            }
        });
    };

    const handleLeaveSpace = () => {
        if (!confirm('Are you sure you want to leave this space?')) return;
        socketService.leaveSpace(space.id, (response) => {
            if (response.error) {
                addToast(response.error, 'error');
            } else {
                addToast('You left the space', 'success');
                onSpaceLeft?.();
                onClose();
            }
        });
    };

    const handleSaveAlias = () => {
        socketService.setMemberAlias(space.id, myAlias.trim() || null, (response) => {
            if (response.error) {
                addToast(response.error, 'error');
            } else {
                addToast(response.alias ? `Alias set to "${response.alias}"` : 'Alias removed', 'success');
            }
        });
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                        'w-full max-w-lg bg-mono-bg rounded-2xl shadow-2xl overflow-hidden',
                        'border border-mono-glass-border'
                    )}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-mono-glass-border">
                        <h2 className="text-lg font-semibold text-mono-text">Space Settings</h2>
                        <ChromeButton variant="circle" onClick={onClose} className="p-2">
                            <X className="w-4 h-4" />
                        </ChromeButton>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-mono-glass-border">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
                                    activeTab === tab.id
                                        ? 'text-mono-text border-b-2 border-white'
                                        : 'text-mono-muted hover:text-mono-text'
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-4 max-h-[60vh] overflow-y-auto">
                        {activeTab === 'general' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-mono-muted mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="input-glass w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-mono-muted mb-1">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="input-glass w-full h-20 resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-mono-muted mb-2">Tone</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(SPACE_TONES).map(([key, t]) => (
                                            <button
                                                key={key}
                                                onClick={() => setTone(key)}
                                                className={cn(
                                                    'p-3 rounded-lg border text-left transition-all',
                                                    tone === key
                                                        ? `${t.border} ${t.bg} ring-2 ring-offset-2 ring-offset-mono-bg ring-white/20`
                                                        : 'border-mono-glass-border hover:border-mono-glass-highlight'
                                                )}
                                            >
                                                <span className={cn('text-sm font-medium', t.color)}>{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* My Alias - Optional */}
                                <div className="pt-4 border-t border-mono-glass-border">
                                    <label className="block text-xs text-mono-muted mb-1">My Alias (Optional)</label>
                                    <p className="text-xs text-mono-muted/70 mb-2">Set a custom tag that appears below your name in messages</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={myAlias}
                                            onChange={(e) => setMyAlias(e.target.value)}
                                            placeholder="e.g. Team Lead, Designer, Night Owl..."
                                            maxLength={50}
                                            className="input-glass flex-1"
                                        />
                                        <ChromeButton onClick={handleSaveAlias} className="px-4">
                                            Set
                                        </ChromeButton>
                                    </div>
                                </div>

                                <ChromeButton onClick={handleSaveGeneral} disabled={isLoading} className="w-full">
                                    {isLoading ? 'Saving...' : 'Save Changes'}
                                </ChromeButton>
                            </div>
                        )}

                        {activeTab === 'members' && (
                            <div className="space-y-4">
                                {/* Search */}
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mono-muted" />
                                        <input
                                            type="text"
                                            placeholder="Search users to invite..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                                            className="input-glass w-full pl-10"
                                        />
                                    </div>
                                    <ChromeButton onClick={handleSearchUsers} disabled={isSearching}>
                                        <UserPlus className="w-4 h-4" />
                                    </ChromeButton>
                                </div>

                                {/* Search Results */}
                                {searchResults.length > 0 && (
                                    <div className="space-y-2 p-2 rounded-lg bg-mono-surface/50">
                                        <p className="text-xs text-mono-muted">Search Results</p>
                                        {searchResults.map((user) => (
                                            <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-mono-surface">
                                                <div className="flex items-center gap-2">
                                                    <Avatar name={user.username} size="sm" />
                                                    <span className="text-sm text-mono-text">{user.display_name || user.username}</span>
                                                </div>
                                                <ChromeButton variant="circle" onClick={() => handleInvite(user.id)} className="p-1.5">
                                                    <UserPlus className="w-3.5 h-3.5" />
                                                </ChromeButton>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Member List */}
                                <div className="space-y-2">
                                    <p className="text-xs text-mono-muted">Members ({members.length})</p>
                                    {members.map((member) => (
                                        <div key={member.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-mono-surface/50">
                                            <div className="flex items-center gap-2">
                                                <Avatar name={member.username} src={member.avatar_url} size="sm" />
                                                <div>
                                                    <span className="text-sm text-mono-text">{member.display_name || member.username}</span>
                                                    {member.role === 'admin' && (
                                                        <span className="ml-2 text-[10px] text-amber-400 uppercase">Admin</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Leave Button */}
                                <button
                                    onClick={handleLeaveSpace}
                                    className="w-full flex items-center justify-center gap-2 p-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Leave Space
                                </button>
                            </div>
                        )}

                        {activeTab === 'quiet' && (
                            <div className="space-y-4">
                                <p className="text-sm text-mono-muted">
                                    During quiet hours, notifications from this space will be muted and the UI will be dimmed.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-mono-muted mb-1">Start Time</label>
                                        <input
                                            type="time"
                                            value={quietStart}
                                            onChange={(e) => setQuietStart(e.target.value)}
                                            className="input-glass w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-mono-muted mb-1">End Time</label>
                                        <input
                                            type="time"
                                            value={quietEnd}
                                            onChange={(e) => setQuietEnd(e.target.value)}
                                            className="input-glass w-full"
                                        />
                                    </div>
                                </div>
                                <ChromeButton onClick={handleSaveQuietHours} disabled={isLoading} className="w-full">
                                    {isLoading ? 'Saving...' : 'Save Quiet Hours'}
                                </ChromeButton>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default SpaceSettingsModal;
