import { describe, it, expect } from 'vitest';
import {
    escapeHtml,
    sanitizeString,
    sanitizeMessage,
    sanitizeObject,
    containsXSS
} from '../../src/utils/sanitize';

describe('Sanitization Utilities', () => {
    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            const input = '<div>Hello & "Welcome"\'s / `world` =</div>';
            const expected = '&lt;div&gt;Hello &amp; &quot;Welcome&quot;&#39;s &#x2F; &#x60;world&#x60; &#x3D;&lt;&#x2F;div&gt;';
            expect(escapeHtml(input)).toBe(expected);
        });

        it('should return empty string if input is empty', () => {
            expect(escapeHtml('')).toBe('');
        });
    });

    describe('sanitizeString', () => {
        it('should remove script tags and their inner content', () => {
            const input = 'Hello <script>alert("XSS")</script> World';
            const expected = 'Hello  World';
            expect(sanitizeString(input)).toBe(expected);
        });

        it('should remove inline on* event handlers', () => {
            const input = '<img src="x" onerror="alert(1)" onload = \'doSomething()\' />';
            const expected = '<img src="x" />';
            expect(sanitizeString(input)).toBe(expected);
        });

        it('should remove javascript: and data: URLs', () => {
            const input = '<a href="javascript:alert(1)">Link</a> <img src="data:image/png;base64,..." />';
            const expected = '<a href="alert(1)">Link</a> <img src="image/png;base64,..." />';
            expect(sanitizeString(input)).toBe(expected);
        });

        it('should return empty string if input is not a string', () => {
            expect(sanitizeString(123 as any)).toBe('');
        });
    });

    describe('sanitizeMessage', () => {
        it('should escape HTML but keep benign text', () => {
            const input = '<b>Bold text</b> and <script>alert(1)</script>';
            const expected = '&lt;b&gt;Bold text&lt;&#x2F;b&gt; and &lt;script&gt;alert(1)&lt;&#x2F;script&gt;';
            expect(sanitizeMessage(input)).toBe(expected);
        });
    });

    describe('sanitizeObject', () => {
        it('should sanitize nested objects and arrays of strings', () => {
            const input = {
                title: 'Hello <script>alert(1)</script>',
                count: 42,
                tags: ['safe', 'unsafe <img src="x" onerror="alert(2)" />'],
                nested: {
                    content: 'javascript:alert(3)',
                }
            };
            const expected = {
                title: 'Hello',
                count: 42,
                tags: ['safe', 'unsafe <img src="x" />'],
                nested: {
                    content: 'alert(3)',
                }
            };
            expect(sanitizeObject(input)).toEqual(expected);
        });
    });

    describe('containsXSS', () => {
        it('should detect potential XSS vectors', () => {
            expect(containsXSS('<script>')).toBe(true);
            expect(containsXSS('javascript:alert(1)')).toBe(true);
            expect(containsXSS('onmouseover=alert(1)')).toBe(true);
            expect(containsXSS('<iframe src="x">')).toBe(true);
            expect(containsXSS('data:text/html,...')).toBe(true);
        });

        it('should return false for benign text', () => {
            expect(containsXSS('Hello world!')).toBe(false);
            expect(containsXSS('Click here to submit your details.')).toBe(false);
            expect(containsXSS('')).toBe(false);
        });

        it('should return false if input is not a string', () => {
            expect(containsXSS(null as any)).toBe(false);
        });
    });
});
