import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronUp, ChevronDown, Loader2, History } from 'lucide-react';
import { cn } from '../utils/theme';
import { parseSearchFilters, getRecentSearches, addRecentSearch } from '../utils/search';
import axios from 'axios';

interface SearchResult {
    id: string;
    room_id: number;
    sender_username: string;
    content: string;
    created_at: string;
    match_snippet: string;
}

interface ChatSearchProps {
    roomId: number;
    isOpen: boolean;
    onClose: () => void;
    onQueryChange?: (query: string) => void;
    onNavigateToMessage: (messageId: string) => void;
}

const ChatSearch: React.FC<ChatSearchProps> = ({
    roomId,
    isOpen,
    onClose,
    onQueryChange,
    onNavigateToMessage
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [total, setTotal] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [showRecent, setShowRecent] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout>();

    // Load recent searches on mount
    useEffect(() => {
        setRecentSearches(getRecentSearches());
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setResults([]);
            setTotal(0);
            setCurrentIndex(0);
            setShowRecent(false);
        }
    }, [isOpen]);

    // Debounced search with filter parsing
    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([]);
            setTotal(0);
            return;
        }

        // Parse filters from query
        const { text, sender, before, after } = parseSearchFilters(searchQuery);

        // Save to recent searches
        addRecentSearch(searchQuery);
        setRecentSearches(getRecentSearches());

        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/search/messages', {
                params: {
                    q: text,
                    roomId,
                    limit: 50,
                    sender,
                    before,
                    after
                },
                headers: { Authorization: `Bearer ${token}` }
            });
            setResults(response.data.results);
            setTotal(response.data.total);
            setCurrentIndex(0);

            // Auto-navigate to first result
            if (response.data.results.length > 0) {
                onNavigateToMessage(response.data.results[0].id);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsLoading(false);
        }
    }, [roomId, onNavigateToMessage]);

    // Handle input change with debounce
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        setShowRecent(false);

        // Extract text part for highlighting (without filters)
        const { text } = parseSearchFilters(value);
        onQueryChange?.(text);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            performSearch(value);
        }, 300);
    };

    // Handle recent search click
    const handleRecentClick = (search: string) => {
        setQuery(search);
        setShowRecent(false);
        const { text } = parseSearchFilters(search);
        onQueryChange?.(text);
        performSearch(search);
    };

    // Navigate between results
    const navigatePrev = () => {
        if (results.length === 0) return;
        const newIndex = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
        setCurrentIndex(newIndex);
        onNavigateToMessage(results[newIndex].id);
    };

    const navigateNext = () => {
        if (results.length === 0) return;
        const newIndex = currentIndex < results.length - 1 ? currentIndex + 1 : 0;
        setCurrentIndex(newIndex);
        onNavigateToMessage(results[newIndex].id);
    };

    // Keyboard shortcuts
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'Enter') {
            if (e.shiftKey) {
                navigatePrev();
            } else {
                navigateNext();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigatePrev();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateNext();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                    "absolute top-0 left-0 right-0 z-50",
                    "bg-mono-surface-1/95 backdrop-blur-sm",
                    "border-b border-mono-glass-border",
                    "shadow-lg"
                )}
            >
                <div className="flex items-center gap-3 px-4 py-3">
                    {/* Search Icon */}
                    <Search className="w-5 h-5 text-mono-muted flex-shrink-0" />

                    {/* Input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => !query && setShowRecent(true)}
                        placeholder="Search... (try from:user or before:2024-01-01)"
                        className={cn(
                            "flex-1 bg-transparent",
                            "text-mono-text placeholder:text-mono-muted",
                            "outline-none border-none",
                            "font-sans text-sm"
                        )}
                    />

                    {/* Loading Indicator */}
                    {isLoading && (
                        <Loader2 className="w-4 h-4 text-mono-muted animate-spin" />
                    )}

                    {/* Results Counter */}
                    {results.length > 0 && (
                        <span className="text-mono-muted text-xs font-mono whitespace-nowrap">
                            {currentIndex + 1} / {total}
                        </span>
                    )}

                    {/* Navigation Buttons */}
                    {results.length > 0 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={navigatePrev}
                                className={cn(
                                    "p-1.5 rounded-md",
                                    "hover:bg-mono-surface-2",
                                    "transition-colors duration-150"
                                )}
                            >
                                <ChevronUp className="w-4 h-4 text-mono-muted" />
                            </button>
                            <button
                                onClick={navigateNext}
                                className={cn(
                                    "p-1.5 rounded-md",
                                    "hover:bg-mono-surface-2",
                                    "transition-colors duration-150"
                                )}
                            >
                                <ChevronDown className="w-4 h-4 text-mono-muted" />
                            </button>
                        </div>
                    )}

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className={cn(
                            "p-1.5 rounded-md",
                            "hover:bg-mono-surface-2",
                            "transition-colors duration-150"
                        )}
                    >
                        <X className="w-4 h-4 text-mono-muted" />
                    </button>
                </div>

                {/* Recent Searches Dropdown */}
                {showRecent && recentSearches.length > 0 && (
                    <div className="px-4 pb-3">
                        <div className="flex items-center gap-2 text-mono-muted text-xs mb-2">
                            <History className="w-3 h-3" />
                            <span>Recent</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {recentSearches.map((search, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleRecentClick(search)}
                                    className={cn(
                                        "px-2 py-1 rounded-md text-xs",
                                        "bg-mono-surface-2 text-mono-text",
                                        "hover:bg-mono-surface-3 transition-colors"
                                    )}
                                >
                                    {search}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* No Results Message */}
                {query && !isLoading && results.length === 0 && !showRecent && (
                    <div className="px-4 pb-3 text-mono-muted text-sm">
                        No messages found
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default ChatSearch;
