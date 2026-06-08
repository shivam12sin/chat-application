import { useState, useCallback } from 'react';
import axios from 'axios';

interface UseMessageDeleteReturn {
    deleteForMe: (messageId: string, roomId: number) => Promise<void>;
    deleteForEveryone: (messageId: string, roomId: number) => Promise<{ undoToken: string; expiresAt: Date }>;
    undoDelete: (undoToken: string) => Promise<boolean>;
    unhideForMe: (messageId: string) => Promise<boolean>;
    pendingDelete: { undoToken: string; messageId: string; expiresAt: Date } | null;
    isDeleting: boolean;
    clearPendingDelete: () => void;
}

export const useMessageDelete = (): UseMessageDeleteReturn => {
    const [pendingDelete, setPendingDelete] = useState<{
        undoToken: string;
        messageId: string;
        expiresAt: Date
    } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const deleteForMe = useCallback(async (messageId: string, roomId: number) => {
        setIsDeleting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/messages/${messageId}`, {
                headers: { Authorization: `Bearer ${token}` },
                data: { mode: 'me', roomId }
            });
        } finally {
            setIsDeleting(false);
        }
    }, []);

    const deleteForEveryone = useCallback(async (messageId: string, roomId: number) => {
        setIsDeleting(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.delete(`/api/messages/${messageId}`, {
                headers: { Authorization: `Bearer ${token}` },
                data: { mode: 'everyone', roomId }
            });

            const { undoToken, expiresAt } = response.data;
            const pending = {
                undoToken,
                messageId,
                expiresAt: new Date(expiresAt)
            };
            setPendingDelete(pending);

            return pending;
        } finally {
            setIsDeleting(false);
        }
    }, []);

    const undoDelete = useCallback(async (undoToken: string) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`/api/messages/${undoToken}/undo`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPendingDelete(null);
            return true;
        } catch {
            return false;
        }
    }, []);

    const unhideForMe = useCallback(async (messageId: string) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`/api/messages/${messageId}/unhide`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return true;
        } catch {
            return false;
        }
    }, []);

    const clearPendingDelete = useCallback(() => {
        setPendingDelete(null);
    }, []);

    return {
        deleteForMe,
        deleteForEveryone,
        undoDelete,
        unhideForMe,
        pendingDelete,
        isDeleting,
        clearPendingDelete
    };
};

