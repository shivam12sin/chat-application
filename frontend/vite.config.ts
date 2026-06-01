import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    // Core vendor libs
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-animation': ['framer-motion'],
                    'vendor-socket': ['socket.io-client'],
                    // Heavy feature libs - loaded on demand
                    'vendor-emoji': ['emoji-picker-react'],
                    'vendor-map': ['leaflet'],
                },
            },
        },
        // Increase warning limit since we're optimizing
        chunkSizeWarningLimit: 600,
    },
})
