import api from './auth';

export interface User {
    id: number;
    username: string;
    display_name?: string;
    avatar_url?: string;
    status?: 'none' | 'connected' | 'sent' | 'received';
}

export interface FriendRequest {
    id: number;
    username: string;
    display_name?: string;
    avatar_url?: string;
    created_at: string;
}

export const searchUsers = async (query: string) => {
    const response = await api.get<User[]>(`/contacts/search`, { params: { query } });
    return response.data;
};

export const sendRequest = async (receiverId: number) => {
    const response = await api.post('/contacts/request', { receiverId });
    return response.data;
};

export const acceptRequest = async (requestId: number) => {
    const response = await api.post(`/contacts/request/${requestId}/accept`);
    return response.data;
};

export const rejectRequest = async (requestId: number) => {
    const response = await api.post(`/contacts/request/${requestId}/reject`);
    return response.data;
};

export const getPendingRequests = async () => {
    const response = await api.get<FriendRequest[]>('/contacts/requests');
    return response.data;
};

export const getContacts = async () => {
    const response = await api.get<User[]>('/contacts');
    return response.data;
};
