import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, createFocusTrap, focusElement } from '../utils/theme';
import ChromeButton from './ChromeButton';

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  className?: string;
  contentClassName?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  children,
  onClose,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  className,
  contentClassName,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle focus trap
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    const { firstElement, lastElement } = createFocusTrap(contentRef.current);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            (lastElement as HTMLElement)?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            (firstElement as HTMLElement)?.focus();
          }
        }
      }
    };

    const handleBackdropClick = (e: MouseEvent) => {
      if (e.target === modalRef.current) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    modalRef.current?.addEventListener('click', handleBackdropClick);

    focusElement(firstElement as HTMLElement, 100);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      modalRef.current?.removeEventListener('click', handleBackdropClick);
    };
  }, [isOpen, onClose]);

  // if (!isOpen) return null; // Removed early return to allow AnimatePresence to handle exit

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          ref={modalRef}
          className={cn(
            'fixed inset-0 z-50',
            'bg-mono-bg/80 backdrop-blur-glass',
            'flex items-center justify-center',
            'p-4'
          )}
          role="presentation"
          aria-hidden="false"
          onClick={(e) => e.target === modalRef.current && onClose()}
        >
          {/* Modal Content */}
          <motion.div
            key="modal-content"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.2, 0.9, 0.2, 1] }}
            ref={contentRef}
            className={cn(
              'relative w-full max-w-md',
              'rounded-glass',
              'bg-mono-surface border border-mono-glass-border',
              'shadow-glass',
              className
            )}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-description"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-mono-glass-border">
              <h2
                id="modal-title"
                className="text-base font-semibold text-mono-text"
              >
                {title}
              </h2>
              <ChromeButton
                onClick={onClose}
                className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-mono-muted hover:text-mono-text"
                variant="circle"
                aria-label="Close modal"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </ChromeButton>
            </div>

            {/* Content */}
            <div
              id="modal-description"
              className={cn(
                'px-6 py-4',
                'text-sm text-mono-text',
                contentClassName
              )}
            >
              {children}
            </div>

            {/* Footer */}
            {onConfirm && (
              <div className="flex gap-2 px-6 py-4 border-t border-mono-glass-border justify-end">
                <ChromeButton
                  onClick={onClose}
                  className="px-4 py-2 text-sm min-h-[40px]"
                >
                  {cancelText}
                </ChromeButton>

                {onConfirm && (
                  <ChromeButton
                    onClick={onConfirm}
                    className={cn(
                      'px-4 py-2 text-sm font-medium min-h-[40px]',
                      isDestructive && 'text-red-400 hover:text-red-300'
                    )}
                  >
                    {confirmText}
                  </ChromeButton>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
