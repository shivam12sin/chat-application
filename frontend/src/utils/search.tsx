import React from 'react';

/**
 * Highlights matching text within a string by wrapping matches in <mark> tags
 * Uses case-insensitive matching
 */
export function highlightText(text: string, query: string): React.ReactNode {
    if (!query || query.trim().length === 0) {
        return text;
    }

    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);

    if (parts.length === 1) {
        return text; // No match found
    }

    return parts.map((part, index) => {
        if (part.toLowerCase() === query.toLowerCase()) {
            return (
                <mark
                    key= { index }
            className = "bg-amber-400/30 text-inherit rounded px-0.5"
                >
                { part }
                </mark>
            );
}
return part;
    });
}

/**
 * Parse search filters from query string
 * Supports: from:username, before:YYYY-MM-DD, after:YYYY-MM-DD
 */
export function parseSearchFilters(query: string): {
    text: string;
    sender?: string;
    before?: string;
    after?: string;
} {
    let text = query;
    let sender: string | undefined;
    let before: string | undefined;
    let after: string | undefined;

    // Extract from:username
    const fromMatch = text.match(/from:(\S+)/i);
    if (fromMatch) {
        sender = fromMatch[1];
        text = text.replace(fromMatch[0], '').trim();
    }

    // Extract before:YYYY-MM-DD
    const beforeMatch = text.match(/before:(\d{4}-\d{2}-\d{2})/i);
    if (beforeMatch) {
        before = beforeMatch[1];
        text = text.replace(beforeMatch[0], '').trim();
    }

    // Extract after:YYYY-MM-DD
    const afterMatch = text.match(/after:(\d{4}-\d{2}-\d{2})/i);
    if (afterMatch) {
        after = afterMatch[1];
        text = text.replace(afterMatch[0], '').trim();
    }

    return { text, sender, before, after };
}

/**
 * Get recent searches from localStorage
 */
export function getRecentSearches(): string[] {
    try {
        const stored = localStorage.getItem('recentSearches');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

/**
 * Add a search query to recent searches
 */
export function addRecentSearch(query: string): string[] {
    const recent = getRecentSearches();
    const trimmed = query.trim();

    if (!trimmed) return recent;

    // Remove if already exists
    const filtered = recent.filter(s => s.toLowerCase() !== trimmed.toLowerCase());

    // Add to front, limit to 5
    const updated = [trimmed, ...filtered].slice(0, 5);

    localStorage.setItem('recentSearches', JSON.stringify(updated));
    return updated;
}

/**
 * Clear recent searches
 */
export function clearRecentSearches(): void {
    localStorage.removeItem('recentSearches');
}
