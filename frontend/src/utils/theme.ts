/**
 * Utility functions for Aether theme
 */

/**
 * Space Tone Definitions
 */
export const SPACE_TONES: Record<string, { label: string; color: string; border: string; bg: string }> = {
  social: {
    label: 'Social',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5'
  },
  focus: {
    label: 'Focus',
    color: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/5'
  },
  work: {
    label: 'Work',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5'
  },
  private: {
    label: 'Private',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5'
  }
};

/**
 * Simple classname combiner (lightweight clsx alternative)
 */
export const cn = (...classes: (string | undefined | false | null | Record<string, boolean>)[]): string => {
  return classes
    .map(cls => {
      if (typeof cls === 'string') return cls;
      if (typeof cls === 'object' && cls !== null) {
        return Object.keys(cls)
          .filter(key => cls[key])
          .join(' ');
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');
};

/**
 * Motion utilities respecting prefers-reduced-motion
 */
export const getMotionDuration = (fast: boolean = false): number => {
  if (typeof window === 'undefined') return fast ? 120 : 220;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return 10;
  return fast ? 120 : 220;
};

export const supportsBackdropFilter = (): boolean => {
  if (typeof window === 'undefined') return false;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return false;
  const div = document.createElement('div');
  div.style.backdropFilter = 'blur(1px)';
  return div.style.backdropFilter !== '';
};

/**
 * Accessibility utilities
 */
export const getAriaLabel = (sender: string, time: string, text: string): string => {
  return `Message from ${sender} at ${time}: ${text}`;
};

export const getStatusAriaLabel = (status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'): string => {
  const labels = {
    sending: 'Sending message',
    sent: 'Message sent',
    delivered: 'Message delivered',
    read: 'Message read',
    failed: 'Message failed to send',
  };
  return labels[status];
};

/**
 * Focus management utilities
 */
export const focusElement = (element: HTMLElement | null, timeout: number = 0) => {
  if (!element) return;
  setTimeout(() => {
    element.focus();
  }, timeout);
};

export const createFocusTrap = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  return {
    firstElement,
    lastElement,
    focusableElements,
  };
};

/**
 * Scroll utilities
 */
export const smoothScroll = (element: HTMLElement, target: HTMLElement) => {
  if (!element || !target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

/**
 * Timestamp formatting
 */
export const formatTimestamp = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const dateToCheck = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (dateToCheck.getTime() === today.getTime()) {
    // Today: show time only
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } else if (dateToCheck.getTime() === yesterday.getTime()) {
    // Yesterday
    return 'Yesterday';
  } else if (now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000) {
    // Within a week
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    // Older
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

/**
 * Screen reader announcements
 */
export const announceToScreenReader = (message: string, assertive: boolean = false) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};
