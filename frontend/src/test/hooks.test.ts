/**
 * Hook tests for custom hooks
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState, useCallback } from 'react';

// Simple useToggle hook for testing
const useToggle = (initialValue = false) => {
    const [value, setValue] = useState(initialValue);
    const toggle = useCallback(() => setValue((v) => !v), []);
    return [value, toggle] as const;
};

// Simple useCounter hook for testing
const useCounter = (initialValue = 0) => {
    const [count, setCount] = useState(initialValue);
    const increment = useCallback(() => setCount((c) => c + 1), []);
    const decrement = useCallback(() => setCount((c) => c - 1), []);
    const reset = useCallback(() => setCount(initialValue), [initialValue]);
    return { count, increment, decrement, reset };
};

// Simple useLocalStorage mock for testing
const useLocalStorageMock = (_key: string, initialValue: string) => {
    const [storedValue, setStoredValue] = useState(initialValue);
    const setValue = useCallback((value: string) => {
        setStoredValue(value);
    }, []);
    return [storedValue, setValue] as const;
};

describe('useToggle Hook', () => {
    it('should initialize with default value', () => {
        const { result } = renderHook(() => useToggle());
        expect(result.current[0]).toBe(false);
    });

    it('should initialize with provided value', () => {
        const { result } = renderHook(() => useToggle(true));
        expect(result.current[0]).toBe(true);
    });

    it('should toggle value', () => {
        const { result } = renderHook(() => useToggle());

        act(() => {
            result.current[1]();
        });

        expect(result.current[0]).toBe(true);
    });

    it('should toggle back', () => {
        const { result } = renderHook(() => useToggle());

        act(() => {
            result.current[1](); // true
            result.current[1](); // false
        });

        expect(result.current[0]).toBe(false);
    });
});

describe('useCounter Hook', () => {
    it('should initialize with default value', () => {
        const { result } = renderHook(() => useCounter());
        expect(result.current.count).toBe(0);
    });

    it('should initialize with provided value', () => {
        const { result } = renderHook(() => useCounter(10));
        expect(result.current.count).toBe(10);
    });

    it('should increment count', () => {
        const { result } = renderHook(() => useCounter());

        act(() => {
            result.current.increment();
        });

        expect(result.current.count).toBe(1);
    });

    it('should decrement count', () => {
        const { result } = renderHook(() => useCounter(5));

        act(() => {
            result.current.decrement();
        });

        expect(result.current.count).toBe(4);
    });

    it('should reset count', () => {
        const { result } = renderHook(() => useCounter(10));

        act(() => {
            result.current.increment();
            result.current.increment();
            result.current.reset();
        });

        expect(result.current.count).toBe(10);
    });
});

describe('useLocalStorage Hook', () => {
    it('should initialize with initial value', () => {
        const { result } = renderHook(() => useLocalStorageMock('key', 'initial'));
        expect(result.current[0]).toBe('initial');
    });

    it('should update value', () => {
        const { result } = renderHook(() => useLocalStorageMock('key', 'initial'));

        act(() => {
            result.current[1]('updated');
        });

        expect(result.current[0]).toBe('updated');
    });
});
