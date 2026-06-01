/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Strict monochrome palette
                mono: {
                    bg: '#000000',      // --bg (Pure black for deep contrast)
                    'bg-100': '#111111', // --bg-100
                    'surface': 'rgba(255,255,255,0.03)',    // --surface (Ultra translucent)
                    'surface-2': 'rgba(255,255,255,0.05)', // --surface-2
                    'glass-border': 'rgba(255,255,255,0.08)',    // --glass-border (Subtle)
                    'glass-highlight': 'rgba(255,255,255,0.12)', // --glass-highlight (Light edge)
                    text: '#ffffff',
                    muted: '#a3a3a3',
                },
                accent: {
                    primary: '#ffffff',      // Pure white for high contrast
                    'primary-hover': '#e5e5e5',
                    secondary: '#a3a3a3',    // Silver/Gray
                    'secondary-hover': '#d4d4d4',
                }
            },
            fontFamily: {
                sans: ['Manrope', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
                display: ['Manrope', 'sans-serif'],
            },
            backdropBlur: {
                glass: '8px',          // P2: Reduced from 24px for performance
                'glass-light': '6px',  // P2: Reduced from 12px
                'glass-strong': '12px', // P2: Reduced from 40px
            },
            boxShadow: {
                'glass-sm': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 0 20px rgba(255,255,255,0.02)',
                'glass': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 0 30px rgba(255,255,255,0.02)',     // --elevation-1
                'glass-lg': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), inset 0 0 50px rgba(255,255,255,0.02)', // --elevation-2
                'glass-inner': 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 0 20px rgba(255,255,255,0.02)',
            },
            animation: {
                'glass-blur': 'blur-motion 0.3s cubic-bezier(0.2, 0.9, 0.2, 1)',
                'fade-up': 'fade-up 0.22s cubic-bezier(0.2, 0.9, 0.2, 1)',
                'fade-in': 'fade-in 0.22s cubic-bezier(0.2, 0.9, 0.2, 1)',
                'slide-up': 'slide-up 0.22s cubic-bezier(0.2, 0.9, 0.2, 1)',
                'bloop': 'bloop 0.4s cubic-bezier(0.2, 0.9, 0.2, 1)',
                'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.2, 0.9, 0.2, 1) infinite',
                'scale-in': 'scale-in 0.3s cubic-bezier(0.2, 0.9, 0.2, 1)',
                'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.2, 0.9, 0.2, 1)',
            },
            keyframes: {
                'fade-up': {
                    '0%': { opacity: '0', transform: 'translateY(6px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'slide-up': {
                    '0%': { transform: 'translateY(8px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                'bloop': {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.02)' },
                },
                'pulse-subtle': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.8' },
                },
                'blur-motion': {
                    '0%': { backdropFilter: 'blur(0px)' },
                    '100%': { backdropFilter: 'blur(12px)' },
                },
                'scale-in': {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                'slide-in-right': {
                    '0%': { transform: 'translateX(20px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
            },
            transitionDuration: {
                'fast': '120ms',
                'normal': '220ms',
            },
            transitionTimingFunction: {
                'glass': 'cubic-bezier(0.2, 0.9, 0.2, 1)',
            },
            borderRadius: {
                'glass': '14px',
            },
            spacing: {
                'touch': '44px', // Touch target minimum
            },
        },
    },
    plugins: [],
}
