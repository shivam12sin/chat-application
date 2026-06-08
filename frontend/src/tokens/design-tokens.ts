/**
 * Design Tokens - Single source of truth for the Cosmic Liquid Glass theme
 * These tokens define all visual properties for the design system
 */

// ============================================
// COLOR PALETTE
// ============================================

export const colors = {
    // Base colors
    mono: {
        bg: '#0a0a0f',
        surface: '#12121a',
        text: '#e0e0e8',
        muted: '#8888aa',
        accent: '#7066ff',
        accentHover: '#8a82ff',
        glass: {
            bg: 'rgba(18, 18, 26, 0.8)',
            border: 'rgba(255, 255, 255, 0.08)',
            glow: 'rgba(112, 102, 255, 0.15)',
        },
    },

    // Semantic colors
    semantic: {
        success: '#22c55e',
        error: '#ef4444',
        warning: '#eab308',
        info: '#3b82f6',
    },

    // Gradient definitions
    gradients: {
        accent: 'linear-gradient(135deg, #7066ff 0%, #a855f7 100%)',
        cosmic: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%)',
        glass: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
    },
};

// ============================================
// TYPOGRAPHY
// ============================================

export const typography = {
    fontFamily: {
        body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        mono: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    },

    fontSize: {
        xs: '0.75rem',     // 12px
        sm: '0.875rem',    // 14px
        base: '1rem',      // 16px
        lg: '1.125rem',    // 18px
        xl: '1.25rem',     // 20px
        '2xl': '1.5rem',   // 24px
        '3xl': '1.875rem', // 30px
        '4xl': '2.25rem',  // 36px
    },

    fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
    },

    lineHeight: {
        tight: 1.25,
        normal: 1.5,
        relaxed: 1.75,
    },
};

// ============================================
// SPACING
// ============================================

export const spacing = {
    px: '1px',
    0: '0',
    0.5: '0.125rem',  // 2px
    1: '0.25rem',     // 4px
    2: '0.5rem',      // 8px
    3: '0.75rem',     // 12px
    4: '1rem',        // 16px
    5: '1.25rem',     // 20px
    6: '1.5rem',      // 24px
    8: '2rem',        // 32px
    10: '2.5rem',     // 40px
    12: '3rem',       // 48px
    16: '4rem',       // 64px
    20: '5rem',       // 80px
};

// ============================================
// BORDER RADIUS
// ============================================

export const radii = {
    none: '0',
    sm: '0.25rem',    // 4px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
    '2xl': '1.5rem',  // 24px
    full: '9999px',
};

// ============================================
// SHADOWS
// ============================================

export const shadows = {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.6)',
    glow: '0 0 20px rgba(112, 102, 255, 0.3)',
    inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)',
};

// ============================================
// TRANSITIONS
// ============================================

export const transitions = {
    fast: '150ms ease',
    normal: '300ms ease',
    slow: '500ms ease',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
};

// ============================================
// Z-INDEX
// ============================================

export const zIndex = {
    tooltip: 50,
    modal: 100,
    popover: 40,
    dropdown: 30,
    header: 20,
    base: 0,
};

// ============================================
// BREAKPOINTS
// ============================================

export const breakpoints = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
};

// Default export
const tokens = {
    colors,
    typography,
    spacing,
    radii,
    shadows,
    transitions,
    zIndex,
    breakpoints,
};

export default tokens;
