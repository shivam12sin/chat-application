import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const uploadFile = async (file: File): Promise<{ url: string; filename: string; mimetype: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);

    let token = localStorage.getItem('token');

    // Validate token exists
    if (!token || token === 'null' || token === 'undefined') {
        throw new Error('Authentication required. Please log in again.');
    }

    // Remove any surrounding quotes that might have been added
    token = token.replace(/^["']|["']$/g, '');

    const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
        }
    });

    return response.data;
};
