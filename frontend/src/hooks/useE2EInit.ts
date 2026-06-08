/**
 * E2E Initialization Hook
 * 
 * Automatically initializes E2E encryption when user connects.
 * This hook should be used in the main app/home component.
 */

import { useEffect, useCallback, useRef } from 'react';
import { e2eCryptoService } from '../crypto/E2ECryptoService';
import { groupE2EService } from '../crypto/GroupE2EService';
import { multiDeviceService } from '../crypto/MultiDeviceService';

interface UseE2EInitOptions {
    token: string | null;
    userId: number | null;
    isConnected: boolean;
    apiUrl: string;
    onError?: (error: Error) => void;
    onInitialized?: () => void;
}

export function useE2EInit({
    token,
    userId,
    isConnected,
    apiUrl,
    onError,
    onInitialized,
}: UseE2EInitOptions): {
    isInitialized: boolean;
    initializeE2E: () => Promise<void>;
} {
    const initializedRef = useRef(false);

    const initializeE2E = useCallback(async () => {
        if (!token || !userId) {
            console.log('E2E: Cannot initialize without token and userId');
            return;
        }

        if (initializedRef.current) {
            console.log('E2E: Already initialized');
            return;
        }

        try {
            console.log('E2E: Initializing crypto service...');
            
            // Initialize main E2E crypto service
            await e2eCryptoService.initialize({
                apiUrl,
                token,
                userId,
            });
            
            // Initialize group E2E service
            await groupE2EService.initialize({
                apiUrl,
                token,
                userId,
            });
            
            // Initialize multi-device service
            await multiDeviceService.initialize({
                apiUrl,
                token,
                userId,
            });
            
            initializedRef.current = true;
            console.log('E2E: All crypto services initialized successfully');
            onInitialized?.();
        } catch (error) {
            console.error('E2E: Initialization failed:', error);
            onError?.(error instanceof Error ? error : new Error(String(error)));
        }
    }, [token, userId, apiUrl, onError, onInitialized]);

    // Auto-initialize when connected
    useEffect(() => {
        if (isConnected && token && userId && !initializedRef.current) {
            initializeE2E();
        }
    }, [isConnected, token, userId, initializeE2E]);

    // Reset on logout
    useEffect(() => {
        if (!token) {
            initializedRef.current = false;
        }
    }, [token]);

    return {
        isInitialized: initializedRef.current,
        initializeE2E,
    };
}

export default useE2EInit;
