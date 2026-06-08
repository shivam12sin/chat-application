import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface ReactionData {
    emoji: string;
    count: number;
    users: number[];
}

interface ReactionResponse {
    success: boolean;
    added: boolean;
    reactions: ReactionData[];
}

export const toggleReaction = async (
    messageId: string,
    emoji: string,
    token: string
): Promise<ReactionResponse> => {
    const response = await axios.post(
        `${API_URL}/reactions/${messageId}`,
        { emoji },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const getReactions = async (
    messageId: string,
    token: string
): Promise<{ reactions: ReactionData[] }> => {
    const response = await axios.get(
        `${API_URL}/reactions/${messageId}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const removeReaction = async (
    messageId: string,
    emoji: string,
    token: string
): Promise<ReactionResponse> => {
    const response = await axios.delete(
        `${API_URL}/reactions/${messageId}/${encodeURIComponent(emoji)}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

// Recently used emojis (stored in localStorage)
const RECENT_EMOJIS_KEY = 'recentReactionEmojis';
const MAX_RECENT_EMOJIS = 3;

export const getRecentEmojis = (): string[] => {
    try {
        const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
        return stored ? JSON.parse(stored) : ['👍', '❤️', '😂'];
    } catch {
        return ['👍', '❤️', '😂'];
    }
};

export const addRecentEmoji = (emoji: string): string[] => {
    const recent = getRecentEmojis().filter(e => e !== emoji);
    const updated = [emoji, ...recent].slice(0, MAX_RECENT_EMOJIS);
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
    return updated;
};
