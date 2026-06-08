import React, { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import { Search, Loader2, Music2, Disc } from 'lucide-react';
import { motion } from 'framer-motion';
import { searchSpotifyTracks, resolveToYoutube, SpotifyTrack } from '../services/spotify';

interface OrbitSearchProps {
    onSelect: (video: { videoId: string, title: string, thumbnail: string, channel: string }) => void;
    onClose: () => void;
}

const OrbitSearch: React.FC<OrbitSearchProps> = ({ onSelect, onClose }) => {
    const [query, setQuery] = useState('');
    const [debouncedQuery] = useDebounce(query, 500);
    const [results, setResults] = useState<SpotifyTrack[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [resolvingId, setResolvingId] = useState<string | null>(null); // Track which ID is currently loading
    const [error, setError] = useState('');

    const YOUTUBE_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
    // Note: Spotify credentials are now on backend, no frontend env var needed

    // Search Spotify when query changes
    useEffect(() => {
        if (!debouncedQuery.trim()) {
            setResults([]);
            return;
        }

        const search = async () => {
            setIsSearching(true);
            setError('');

            try {
                const tracks = await searchSpotifyTracks(debouncedQuery);
                setResults(tracks);
                if (tracks.length === 0) setError('No results found. Ensure Spotify is configured on server.');
            } catch (err: any) {
                console.error('Search failed', err);
                if (err.message?.includes('not configured')) {
                    setError('Spotify not configured on server. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to backend .env');
                } else {
                    setError('Failed to search Spotify.');
                }
            } finally {
                setIsSearching(false);
            }
        };

        search();
    }, [debouncedQuery]);

    const handleSelect = async (track: SpotifyTrack) => {
        if (resolvingId || !YOUTUBE_KEY) return;

        setResolvingId(track.id);

        try {
            // "The Bridge": Find the audio on YouTube
            const videoId = await resolveToYoutube(track, YOUTUBE_KEY);

            if (videoId) {
                onSelect({
                    videoId: videoId,
                    title: track.name, // Use clean Spotify Title
                    thumbnail: track.album.images[0]?.url || '', // High Res Spotify Art
                    channel: track.artists[0].name // Clean Artist Name
                });
                onClose();
            } else {
                setError(`Could not find audio for "${track.name}"`);
            }
        } catch (err) {
            setError('Failed to load audio stream.');
        } finally {
            setResolvingId(null);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col h-full max-h-[600px] w-full max-w-2xl bg-mono-bg/95 backdrop-blur-glass border border-mono-glass-border rounded-3xl shadow-2xl overflow-hidden"
        >
            {/* Header */}
            <div className="p-4 border-b border-mono-glass-border flex items-center gap-3">
                <Music2 className={`w-6 h-6 text-mono-highlight ${isSearching ? 'animate-pulse' : ''}`} />
                <h2 className="text-lg font-semibold text-mono-text">Orbit</h2>
                <div className="flex-1" />
                <button onClick={onClose} className="text-mono-muted hover:text-mono-text">✕</button>
            </div>

            {/* Search Bar */}
            <div className="p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-mono-muted" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search Spotify..."
                        className="w-full pl-10 pr-4 py-3 bg-mono-surface/50 border border-mono-glass-border rounded-xl text-mono-text placeholder-mono-muted focus:outline-none focus:border-mono-glass-highlight focus:ring-1 focus:ring-mono-glass-highlight transition-all"
                        autoFocus
                    />
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isSearching && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-8 h-8 text-mono-highlight animate-spin" />
                    </div>
                )}

                {!isSearching && error && (
                    <div className="text-center text-red-400 py-10 text-sm bg-red-500/10 rounded-xl m-2 border border-red-500/20">{error}</div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {results.map((track) => {
                        const isResolving = resolvingId === track.id;
                        return (
                            <motion.div
                                key={track.id}
                                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)' }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSelect(track)}
                                className={`
                                    relative bg-mono-surface/30 border border-mono-glass-border rounded-xl p-3 
                                    flex gap-3 cursor-pointer group transition-colors overflow-hidden
                                    ${isResolving ? 'border-mono-highlight/50 bg-mono-highlight/10' : ''}
                                `}
                            >
                                {/* Album Art */}
                                <div className="relative w-16 h-16 flex-shrink-0">
                                    <img
                                        src={track.album.images[1]?.url || track.album.images[0]?.url} // Use medium size if available
                                        alt={track.name}
                                        className={`w-full h-full object-cover rounded-md shadow-md ${isResolving ? 'opacity-50' : ''}`}
                                    />
                                    {isResolving && (
                                        <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/20 via-transparent to-blue-900/20 opacity-30">
                                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                                        </div>
                                    )}
                                </div>

                                {/* Metadata */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <h3 className="text-sm font-semibold text-mono-text truncate" title={track.name}>
                                        {track.name}
                                    </h3>
                                    <p className="text-xs text-mono-muted truncate">
                                        {track.artists.map(a => a.name).join(', ')}
                                    </p>
                                </div>

                                {/* Spotify Icon Badge */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Disc className="w-4 h-4 text-[#1DB954]" />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Footer Warning - only show for YouTube since Spotify is on backend */}
            {!YOUTUBE_KEY && (
                <div className="p-3 bg-orange-500/10 border-t border-orange-500/20 text-orange-200 text-xs text-center flex flex-col text-pretty">
                    <span>Setup Required:</span>
                    <span>• Missing VITE_YOUTUBE_API_KEY (needed to play audio)</span>
                </div>
            )}
        </motion.div>
    );
};

export default OrbitSearch;
