import React, { useEffect, useState } from 'react';
import { getPendingRequests, acceptRequest, rejectRequest, FriendRequest } from '../../api/contacts';
import { cn } from '../../utils/theme';
import { useToast } from '../../hooks/useToast';
import { Check, X, Clock } from 'lucide-react';
import ChromeButton from '../ChromeButton';

const RequestList: React.FC = () => {
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { success, error: errorToast } = useToast();

    const fetchRequests = async () => {
        try {
            const data = await getPendingRequests();
            setRequests(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
        const interval = setInterval(fetchRequests, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    const handleAccept = async (reqId: number) => {
        try {
            await acceptRequest(reqId);
            setRequests(prev => prev.filter(r => r.id !== reqId));
            success('Request accepted!');
            // Ideally trigger refresh of contacts in Sidebar or global state
            window.location.reload(); // Simple brute force update for now
        } catch (err: any) {
            errorToast('Failed to accept request');
        }
    };

    const handleReject = async (reqId: number) => {
        try {
            await rejectRequest(reqId);
            setRequests(prev => prev.filter(r => r.id !== reqId));
            success('Request rejected');
        } catch (err: any) {
            errorToast('Failed to reject request');
        }
    };

    if (isLoading && requests.length === 0) {
        return <div className="p-4 text-center text-mono-muted text-sm">Loading requests...</div>;
    }

    if (requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-mono-muted h-full">
                <Clock className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No pending requests</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {requests.map(req => (
                <div
                    key={req.id}
                    className={cn(
                        'p-3 rounded-glass',
                        'bg-mono-surface/50 border border-mono-glass-border',
                        'flex items-center justify-between',
                        'transition-all duration-fast ease-glass'
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-mono-surface-2 border border-mono-glass-border flex items-center justify-center text-mono-text font-semibold">
                            {req.avatar_url ? (
                                <img src={req.avatar_url} alt={req.username} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                req.display_name?.[0] || req.username[0]
                            ).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-medium text-mono-text text-sm">
                                {req.display_name || req.username}
                            </h3>
                            <p className="text-xs text-mono-muted">Sent you a request</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <ChromeButton
                            onClick={() => handleAccept(req.id)}
                            className="p-2 rounded-full min-w-[32px] min-h-[32px] flex items-center justify-center text-white"
                            variant="circle"
                            title="Accept"
                        >
                            <Check className="w-4 h-4" />
                        </ChromeButton>
                        <ChromeButton
                            onClick={() => handleReject(req.id)}
                            className="p-2 rounded-full min-w-[32px] min-h-[32px] flex items-center justify-center text-mono-muted hover:text-white"
                            variant="circle"
                            title="Reject"
                        >
                            <X className="w-4 h-4" />
                        </ChromeButton>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default RequestList;
