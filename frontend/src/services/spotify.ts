/**
 * Spotify Service - Secure implementation via backend
 * 
 * Token generation is handled by backend to keep client_secret secure.
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface SpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    album: {
        name: string;
        images: { url: string; height: number; width: number }[];
    };
}

/**
 * Get Spotify access token from backend
 */
export const getSpotifyToken = async (): Promise<string> => {
    try {
        const response = await axios.get(`${API_URL}/spotify/token`);
        return response.data.access_token;
    } catch (error: any) {
        if (error.response?.status === 503) {
            throw new Error('Spotify not configured on server');
        }
        throw error;
    }
};

/**
 * Search Spotify tracks via backend proxy
 */
export const searchSpotifyTracks = async (query: string): Promise<SpotifyTrack[]> => {
    try {
        const response = await axios.get(`${API_URL}/spotify/search`, {
            params: { q: query }
        });
        return response.data;
    } catch (error: any) {
        console.error('Spotify Search Error:', error.message);
        return [];
    }
};

/**
 * Bridges Spotify Track to YouTube Video
 * Searches YouTube for "Artist - Track Name"
 */
export const resolveToYoutube = async (track: SpotifyTrack, youtubeKey: string): Promise<string | null> => {
    if (!youtubeKey) return null;

    const query = `${track.artists[0].name} - ${track.name}`;

    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'id',
                maxResults: 1,
                q: query,
                type: 'video',
                key: youtubeKey.trim()
            }
        });

        if (response.data.items && response.data.items.length > 0) {
            return response.data.items[0].id.videoId;
        }

        return null;
    } catch (error: any) {
        console.error('YouTube API Error:', error.response?.data || error.message);
        return null;
    }
};
