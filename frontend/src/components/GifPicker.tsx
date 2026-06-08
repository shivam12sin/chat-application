import React, { useState } from 'react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import { useDebounce } from 'use-debounce';
import ChromeButton from './ChromeButton';

// SECURITY: API key must come from environment variable only
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY;
const gf = GIPHY_API_KEY ? new GiphyFetch(GIPHY_API_KEY) : null;

interface GifPickerProps {
    onSelect: (gif: any) => void;
    onClose: () => void;
}

const GifPicker: React.FC<GifPickerProps> = ({ onSelect, onClose }) => {
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebounce(search, 500);
    // const [width, setWidth] = useState(window.innerWidth < 400 ? window.innerWidth - 40 : 350);
    const width = window.innerWidth < 400 ? window.innerWidth - 40 : 350;

    // Show error if no API key configured
    if (!gf) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-mono-surface p-6 rounded-glass border border-mono-glass-border">
                    <p className="text-mono-muted">GIF feature requires VITE_GIPHY_API_KEY</p>
                    <ChromeButton onClick={onClose} className="mt-4">Close</ChromeButton>
                </div>
            </div>
        );
    }

    const fetchGifs = (offset: number) => {
        if (debouncedSearch) {
            return gf.search(debouncedSearch, { offset, limit: 10 });
        }
        return gf.trending({ offset, limit: 10 });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-mono-surface w-full max-w-md rounded-glass border border-mono-glass-border shadow-2xl flex flex-col h-[500px] animate-fade-up">
                <div className="p-4 border-b border-mono-glass-border flex justify-between items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search GIFs..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-glass flex-1"
                        autoFocus
                    />
                    <ChromeButton onClick={onClose} variant="circle" className="text-mono-muted hover:text-mono-text min-h-[36px] min-w-[36px]">✕</ChromeButton>
                </div>

                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    <Grid
                        width={width}
                        columns={3}
                        fetchGifs={fetchGifs}
                        key={debouncedSearch} // Force re-render on search change
                        onGifClick={(gif, e) => {
                            e.preventDefault();
                            onSelect(gif);
                        }}
                        noLink
                    />
                </div>
            </div>
        </div>
    );
};

export default GifPicker;
