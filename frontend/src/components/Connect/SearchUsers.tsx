import React, { useState } from 'react';
import { useDebounce } from 'use-debounce';
import { searchUsers, sendRequest, User } from '../../api/contacts';
import { cn } from '../../utils/theme';
import { useToast } from '../../hooks/useToast';
import { Search, UserPlus, Clock, UserCheck } from 'lucide-react';
import ChromeButton from '../ChromeButton';

const SearchUsers: React.FC = () => {
    const [query, setQuery] = useState('');
    const [debouncedQuery] = useDebounce(query, 500);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { success, error: errorToast } = useToast();

    React.useEffect(() => {
        if (!debouncedQuery.trim()) {
            setUsers([]);
            return;
        }

        const handleSearch = async () => {
            setIsLoading(true);
            try {
                const results = await searchUsers(debouncedQuery);
                setUsers(results);
            } catch (err) {
                console.error(err);
                // Silent error or retry
            } finally {
                setIsLoading(false);
            }
        };

        handleSearch();
    }, [debouncedQuery]);

    const handleConnect = async (userId: number) => {
        try {
            await sendRequest(userId);
            setUsers(prev => prev.map(u =>
                u.id === userId ? { ...u, status: 'sent' } : u
            ));
            success('Request sent!');
        } catch (err: any) {
            errorToast(err.response?.data?.error || 'Failed to send request');
        }
    };

    const renderAction = (user: User) => {
        if (user.status === 'connected') {
            return (
                <span className="text-green-500 flex items-center gap-1 text-xs">
                    <UserCheck className="w-4 h-4" /> Connected
                </span>
            );
        }
        if (user.status === 'sent') {
            return (
                <span className="text-mono-muted flex items-center gap-1 text-xs">
                    <Clock className="w-4 h-4" /> Pending
                </span>
            );
        }
        if (user.status === 'received') {
            return (
                <span className="text-accent-primary flex items-center gap-1 text-xs">
                    <Clock className="w-4 h-4" /> Received
                </span>
            );
        }

        return (
            <ChromeButton
                onClick={() => handleConnect(user.id)}
                className="p-2 rounded-full min-w-[36px] min-h-[36px] flex items-center justify-center text-accent-primary hover:text-accent-primary-hover"
                variant="circle"
                title="Connect"
            >
                <UserPlus className="w-4 h-4" />
            </ChromeButton>
        );
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-mono-glass-border">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mono-muted" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search users by username..."
                        className="input-glass w-full pl-9 pr-4 py-2 text-sm"
                        autoFocus
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {isLoading && (
                    <div className="text-center text-mono-muted text-sm py-4">Searching...</div>
                )}

                {!isLoading && users.length === 0 && query && (
                    <div className="text-center text-mono-muted text-sm py-4">No users found.</div>
                )}

                {users.map(user => (
                    <div
                        key={user.id}
                        className={cn(
                            'p-3 rounded-glass',
                            'bg-mono-surface/50 border border-transparent hover:border-mono-glass-border',
                            'flex items-center justify-between',
                            'transition-all duration-fast ease-glass'
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-mono-surface-2 to-mono-glass-highlight flex items-center justify-center text-mono-text font-semibold">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    user.display_name?.[0] || user.username[0]
                                ).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-medium text-mono-text text-sm">
                                    {user.display_name || user.username}
                                </h3>
                                <p className="text-xs text-mono-muted">@{user.username}</p>
                            </div>
                        </div>

                        {renderAction(user)}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SearchUsers;
