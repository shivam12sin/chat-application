import { useState, useCallback } from 'react';
import { ToastType } from '../components/Toast';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (
      message: string,
      type: ToastType = 'info',
      duration: number = 4000,
      action?: Toast['action']
    ) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const toast: Toast = {
        id,
        message,
        type,
        duration,
        action,
      };

      setToasts((prev) => [...prev, toast]);

      if (duration !== 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string, duration?: number, action?: Toast['action']) =>
      addToast(message, 'success', duration, action),
    [addToast]
  );

  const error = useCallback(
    (message: string, duration?: number, action?: Toast['action']) =>
      addToast(message, 'error', duration, action),
    [addToast]
  );

  const warning = useCallback(
    (message: string, duration?: number, action?: Toast['action']) =>
      addToast(message, 'warning', duration, action),
    [addToast]
  );

  const info = useCallback(
    (message: string, duration?: number, action?: Toast['action']) =>
      addToast(message, 'info', duration, action),
    [addToast]
  );

  return {
    toasts,
    addToast,
    dismissToast,
    success,
    error,
    warning,
    info,
  };
};
