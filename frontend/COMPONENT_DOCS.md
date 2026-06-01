# Liquid-Glass Component System

A complete, accessible, monochrome React component library implementing a strict liquid-glass (glassmorphism) aesthetic.

## 🎨 Design Philosophy

- **Strict Monochrome**: Black (#0b0b0b), white (#ffffff), and grayscale only
- **Liquid Glass**: Glassmorphism with backdrop blur and translucency
- **Minimal**: Clean, uncluttered interfaces with ample whitespace
- **Accessible**: WCAG AA+ compliant with full keyboard navigation
- **Subtle Animations**: Cute, non-intrusive motion that respects `prefers-reduced-motion`

## 📦 Core Components

### GlassPanel
Reusable glass-morphism container component.

**Variants:**
- `default`: Standard glass panel
- `elevated`: Higher shadow for prominence
- `ghost`: Subtle, minimal transparency

**Props:**
```tsx
interface GlassPanelProps {
  variant?: 'default' | 'elevated' | 'ghost';
  interactive?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  role?: string;
  ariaLabel?: string;
}
```

**Usage:**
```tsx
import { GlassPanel } from '@/components';

export default function Example() {
  return (
    <GlassPanel variant="elevated" interactive onClick={handleClick}>
      <p>Glass content</p>
    </GlassPanel>
  );
}
```

### Sidebar
Chat room navigation with keyboard support.

**Features:**
- Arrow key navigation (Up/Down/Home/End)
- Enter/Space to select room
- Unread badge management
- Online status indicator
- Room search and filtering ready
- Settings, profile, logout buttons

**Props:**
```tsx
interface SidebarProps {
  rooms: Room[];
  selectedRoomId?: string;
  onRoomSelect: (roomId: string) => void;
  onCreateRoom?: () => void;
  className?: string;
}
```

### MessageList
Infinite-scrolling message container.

**Features:**
- Cursor-based pagination
- Load earlier messages on scroll up
- Auto-scroll to latest message
- Empty state handling
- Loading indicators
- ARIA live region for screen readers

**Props:**
```tsx
interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  roomName?: string;
  className?: string;
}
```

### MessageItem
Individual message bubble with reactions and status.

**Features:**
- Sent/received differentiation
- Message status (sent/delivered/read)
- Reaction display and management
- Hover actions (react, more options)
- Timestamp formatting
- Full accessibility labels

### Composer
Auto-expanding message input field.

**Features:**
- Auto-grow textarea
- Ctrl/Cmd+Enter to send
- Shift+Enter for new line
- Character counter
- Attachment and emoji buttons
- Focus-aware hint text
- Disabled state support

**Keyboard Shortcuts:**
- `Ctrl+Enter` / `Cmd+Enter`: Send message
- `Shift+Enter`: New line

### Modal
WAI-ARIA compliant dialog component.

**Features:**
- Focus trap (keeps focus inside)
- ESC key to close
- Backdrop click to close
- Tab/Shift+Tab navigation
- Destructive action styling option
- Smooth animations

**Props:**
```tsx
interface ModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}
```

### Toast Notifications
Dismissible notification system.

**Types:**
- `success`: Green, confirmation messages
- `error`: Red, error messages
- `warning`: Yellow, warning messages
- `info`: Blue, informational messages

**Features:**
- Auto-dismiss after duration (customizable)
- Manual dismiss button
- Optional action buttons
- Position options (top-right, top-left, bottom-right, bottom-left)
- ARIA live region announcements

**Usage with Hook:**
```tsx
import { useToast } from '@/hooks/useToast';

export default function Example() {
  const { success, error, warning, info } = useToast();

  return (
    <>
      <button onClick={() => success('Copied!')}>Copy</button>
      <button onClick={() => error('Failed to save')}>Delete</button>
    </>
  );
}
```

### TypingIndicator
Shows when users are typing.

**Features:**
- Avatar stack for multiple users
- Animated dots
- User count indicator
- Accessible status announcements

### MainLayout
Complete 3-panel chat interface.

**Features:**
- Sidebar with room list
- Main chat area with messages
- Message composer
- Responsive mobile design
- Modal and toast integration
- Full component orchestration example

### ComponentGallery
Visual showcase of all components.

Use for:
- Development and testing
- Documentation
- Accessibility validation
- Design system verification

## 🎯 Design Tokens

All components use CSS variables defined in `src/styles/design-tokens.css`:

```css
/* Colors */
--bg: #0b0b0b;
--bg-100: #111111;
--surface: rgba(255,255,255,0.06);
--surface-2: rgba(255,255,255,0.04);
--glass-border: rgba(255,255,255,0.10);
--glass-highlight: rgba(255,255,255,0.08);
--text: #ffffff;
--muted: #bdbdbd;

/* Motion */
--motion-fast: 120ms;
--motion-normal: 220ms;
--ease-glass: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Spacing */
--radius-glass: 14px;
```

## ⌨️ Keyboard Navigation

### Global
- `Tab`: Navigate forward
- `Shift+Tab`: Navigate backward
- `Escape`: Close modals/dropdowns

### Component-Specific

**Sidebar:**
- `Arrow Up/Down`: Navigate rooms
- `Home/End`: Jump to first/last room
- `Enter/Space`: Select room

**Composer:**
- `Ctrl+Enter`/`Cmd+Enter`: Send message
- `Shift+Enter`: New line

**Modal:**
- `Tab`: Cycle through focusable elements (with trap)
- `Escape`: Close modal

## ♿ Accessibility

All components meet WCAG 2.1 Level AA standards:

- ✓ Semantic HTML (`<button>`, `<nav>`, `<ul>`, `<li>`)
- ✓ ARIA labels and roles
- ✓ Focus management and visible focus indicators
- ✓ Keyboard navigation
- ✓ Color contrast (minimum 4.5:1)
- ✓ `prefers-reduced-motion` support
- ✓ High contrast mode support
- ✓ Screen reader announcements

## 🎬 Animations

All animations:
- Respect `prefers-reduced-motion` (instant when enabled)
- Use appropriate easing (`ease-glass` cubic-bezier)
- Have consistent timing (fast: 120ms, normal: 220ms)
- Are subtle and purposeful

**Available Animations:**
- `fade-up`: Fade in while moving up
- `slide-up`: Slide up into view
- `bloop`: Bouncy entrance
- `pulse-subtle`: Gentle pulsing glow

## 🛠️ Utilities

### `cn()` - Classname Combiner
```tsx
import { cn } from '@/utils/theme';

cn(
  'px-4 py-2 rounded-glass',
  'bg-mono-surface hover:bg-mono-surface/80',
  isActive && 'border-mono-glass-highlight'
)
```

### Motion Utilities
```tsx
import { getMotionDuration, supportsBackdropFilter } from '@/utils/theme';

const duration = getMotionDuration(); // Returns 10ms if motion reduced
const hasBlur = supportsBackdropFilter(); // Checks device capability
```

### Accessibility Utilities
```tsx
import {
  getAriaLabel,
  getStatusAriaLabel,
  focusElement,
  createFocusTrap,
  announceToScreenReader
} from '@/utils/theme';
```

## 📱 Responsive Design

- **Mobile**: Single column, stack layout
- **Tablet**: Two column (sidebar + chat)
- **Desktop**: Three column (sidebar + chat + info)

Use Tailwind responsive modifiers:
```tsx
<div className="hidden md:flex w-80">
  {/* Hidden on mobile, shown on medium+ screens */}
</div>
```

## 🎨 Theming

To customize:

1. **Colors**: Edit CSS variables in `src/styles/design-tokens.css`
2. **Animations**: Modify `@keyframes` in design-tokens.css or tailwind.config.js
3. **Tailwind Config**: Extend theme in `tailwind.config.js`

⚠️ **Important**: Maintain strict monochrome constraint. Only use #0b0b0b (black), #ffffff (white), and shades of gray.

## 🧪 Testing

### Visual Testing
1. Use `ComponentGallery` component
2. Test all variants and states
3. Verify animations on `prefers-reduced-motion`
4. Test on different screen sizes

### Accessibility Testing
1. Keyboard navigation (Tab, Arrow keys, Enter, Escape)
2. Screen reader announcements
3. Color contrast validation
4. Focus indicator visibility
5. ARIA labels correctness

### Cross-Browser
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📚 File Structure

```
frontend/src/
├── components/
│   ├── GlassPanel.tsx
│   ├── Sidebar.tsx
│   ├── MessageList.tsx
│   ├── MessageItem.tsx
│   ├── Composer.tsx
│   ├── Modal.tsx
│   ├── Toast.tsx
│   ├── TypingIndicator.tsx
│   ├── MainLayout.tsx
│   ├── ComponentGallery.tsx
│   └── index.ts
├── hooks/
│   └── useToast.ts
├── utils/
│   └── theme.ts
└── styles/
    └── design-tokens.css
```

## 🚀 Usage Example

```tsx
import {
  MainLayout,
  GlassPanel,
  Modal,
  Composer,
  Sidebar,
  MessageList,
  TypingIndicator,
  ToastContainer
} from '@/components';
import { useToast } from '@/hooks/useToast';

export default function ChatApp() {
  const { toasts, dismissToast, success } = useToast();

  return (
    <>
      <MainLayout />
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        position="top-right"
      />
    </>
  );
}
```

## 📋 Checklist for New Components

When creating new components following this system:

- [ ] Use CSS variables from design-tokens.css
- [ ] Implement `cn()` utility for classname management
- [ ] Add full ARIA labels and roles
- [ ] Support keyboard navigation
- [ ] Include focus styles
- [ ] Respect `prefers-reduced-motion`
- [ ] Add TypeScript interfaces
- [ ] Document props
- [ ] Include accessibility notes
- [ ] Test with screen reader
- [ ] Add to ComponentGallery
- [ ] Update component index
- [ ] Write this documentation section

## 🔗 Related Documentation

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [WAI-ARIA Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Web Docs](https://developer.mozilla.org/)
- [Glass Morphism Effects](https://en.wikipedia.org/wiki/Glassmorphism)

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Status**: Active Development
