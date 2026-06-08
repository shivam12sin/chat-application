/**
 * Input sanitization utility
 * Prevents XSS attacks by escaping HTML entities
 */

/**
 * Escape HTML entities to prevent XSS
 */
export const escapeHtml = (str: string): string => {
    const htmlEntities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;',
    };

    return str.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char]);
};

/**
 * Sanitize a string for safe display
 * Removes script tags and dangerous attributes
 */
export const sanitizeString = (input: string): string => {
    if (typeof input !== 'string') return '';

    // Remove script tags and their content
    let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove on* event handlers
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*(['"]).*?\1/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');

    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript:/gi, '');

    // Remove data: URLs (can be used for XSS)
    sanitized = sanitized.replace(/data:/gi, '');

    return sanitized.trim();
};

/**
 * Sanitize message content
 * Allows some safe HTML but removes dangerous elements
 */
export const sanitizeMessage = (content: string): string => {
    if (typeof content !== 'string') return '';

    // For messages, we want to escape HTML but preserve line breaks
    return escapeHtml(content);
};

/**
 * Sanitize an object's string properties recursively
 */
export const sanitizeObject = <T extends Record<string, unknown>>(obj: T): T => {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value);
        } else if (Array.isArray(value)) {
            sanitized[key] = value.map((item) =>
                typeof item === 'string' ? sanitizeString(item) : item
            );
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value as Record<string, unknown>);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized as T;
};

/**
 * Check if a string contains potential XSS
 */
export const containsXSS = (input: string): boolean => {
    if (typeof input !== 'string') return false;

    const xssPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /<embed/i,
        /<object/i,
        /data:/i,
        /vbscript:/i,
    ];

    return xssPatterns.some((pattern) => pattern.test(input));
};
