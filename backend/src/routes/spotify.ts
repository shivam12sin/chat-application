/**
 * Spotify Routes - Secure token generation
 * 
 * Client credentials flow handled server-side to keep client_secret secure.
 * Frontend calls GET /api/spotify/token to get an access token.
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Token cache to avoid hitting Spotify API on every request
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

/**
 * GET /api/spotify/token
 * Returns a Spotify access token for client use
 */
router.get('/token', async (_req: Request, res: Response) => {
    try {
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return res.status(503).json({
                error: 'Spotify not configured',
                message: 'SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET env vars required'
            });
        }

        // Check cached token
        if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
            return res.json({ access_token: cachedToken });
        }

        // Request new token from Spotify
        const response = await axios.post(
            SPOTIFY_TOKEN_URL,
            new URLSearchParams({ grant_type: 'client_credentials' }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
                }
            }
        );

        // Cache the token (expire 5 mins early)
        cachedToken = response.data.access_token;
        tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 300000;

        res.json({ access_token: cachedToken });
        return;
    } catch (error: any) {
        console.error('Spotify token error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to get Spotify token' });
        return;
    }
});

/**
 * GET /api/spotify/search
 * Search Spotify tracks (proxied through backend for security)
 */
router.get('/search', async (req: Request, res: Response) => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string') {
            return res.status(400).json({ error: 'Query parameter q is required' });
        }

        // Get token (uses cache if available)
        const tokenRes = await axios.get(`http://localhost:${process.env.PORT || 3000}/api/spotify/token`);
        const token = tokenRes.data.access_token;

        // Search Spotify
        const searchRes = await axios.get('https://api.spotify.com/v1/search', {
            params: {
                q,
                type: 'track',
                limit: 10
            },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        res.json(searchRes.data.tracks.items);
        return;
    } catch (error: any) {
        console.error('Spotify search error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Spotify search failed' });
        return;
    }
});

export default router;
