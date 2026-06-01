# Liquid-Glass Theme Implementation Guide

## Quick Start

### 1. View the Component Gallery

To see all components in action:

```bash
# Start the development server
npm run dev

# Visit the component gallery
http://localhost:5173/gallery
```

Or update `frontend/src/main.tsx` to render `ComponentGallery`:

```tsx
import ComponentGallery from './components/ComponentGallery';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ComponentGallery />
  </React.StrictMode>,
);
```

### 2. Implement MainLayout in Your App

Replace your existing app layout with MainLayout:

```tsx
import MainLayout from './components/MainLayout';
import ToastContainer from './components/Toast';
import { useToast } from './hooks/useToast';

function App() {
  const { toasts, dismissToast } = useToast();

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

### 3. Integrate with Your Backend

**Update API calls in MainLayout:**

```tsx
// In MainLayout.tsx, replace mock data with API calls
useEffect(() => {
  fetchRooms()
    .then(setRooms)
    .catch((err) => error('Failed to load rooms'));
}, []);

useEffect(() => {
  if (selectedRoomId) {
    fetchMessages(selectedRoomId)
      .then(setMessages)
      .catch((err) => error('Failed to load messages'));
  }
}, [selectedRoomId]);
```

**Update message sending:**

```tsx
const handleSendMessage = useCallback(async (content: string) => {
  try {
    await sendMessage(selectedRoomId, content);
    success('Message sent');
    // Optionally refresh messages
    const updated = await fetchMessages(selectedRoomId);
    setMessages(updated);
  } catch (err) {
    error('Failed to send message');
  }
}, [selectedRoomId]);
```

## Component Integration Patterns

### Using Toast Notifications

```tsx
import { useToast } from '@/hooks/useToast';

function MyComponent() {
  const { success, error, warning, info } = useToast();

  const handleAction = async () => {
    try {
      // ... do something
      success('Operation completed!');
    } catch (err) {
      error('Something went wrong');
    }
  };

  return <button onClick={handleAction}>Do Something</button>;
}
```

### Using Modal

```tsx
import { useState } from 'react';
import Modal from '@/components/Modal';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>
      <Modal
        isOpen={isOpen}
        title="Confirm Action"
        onClose={() => setIsOpen(false)}
        onConfirm={() => {
          // Handle confirmation
          setIsOpen(false);
        }}
        confirmText="Confirm"
        cancelText="Cancel"
      >
        <p>Are you sure you want to proceed?</p>
      </Modal>
    </>
  );
}
```

### Building Custom Components

Follow the pattern:

```tsx
import { cn } from '@/utils/theme';

interface MyComponentProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const MyComponent: React.FC<MyComponentProps> = ({
  children,
  onClick,
  className,
}) => {
  return (
    <div
      className={cn(
        // Base styles
        'px-4 py-2 rounded-glass',
        
        // Surface
        'bg-mono-surface border border-mono-glass-border',
        
        // Hover/Active states
        'hover:bg-mono-surface/80 hover:border-mono-glass-highlight',
        'active:scale-95',
        
        // Transitions
        'transition-all duration-fast ease-glass',
        
        // Accessibility
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-mono-text/50',
        
        // Custom classes
        className
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="My Component"
    >
      {children}
    </div>
  );
};

export default MyComponent;
```

## Styling Best Practices

### Use Design Tokens
```tsx
// ✓ Good
className="bg-mono-surface text-mono-text border-mono-glass-border"

// ✗ Avoid
className="bg-slate-900 text-white border-slate-700"
```

### Consistent Spacing
```tsx
// ✓ Use Tailwind scale
className="p-4 gap-2 rounded-glass"

// ✗ Avoid arbitrary values
className="p-[17px] gap-[7px]"
```

### Interactive States
```tsx
// Always include these for interactive elements
className={cn(
  'hover:bg-mono-surface/80',           // Hover
  'active:scale-95',                     // Active
  'disabled:opacity-50',                 // Disabled
  'focus-visible:outline ...',          // Focus
  'transition-all duration-fast ease-glass'  // Animation
)}
```

## Accessibility Checklist

Before shipping a new component:

- [ ] **Semantic HTML**: Use appropriate tags (`<button>`, `<nav>`, etc.)
- [ ] **ARIA Labels**: Add labels for screen readers
- [ ] **Keyboard Nav**: Support Tab, Shift+Tab, Enter, Escape
- [ ] **Focus Management**: Visible focus indicators on all interactive elements
- [ ] **Focus Trap**: Keep focus inside modals
- [ ] **Live Regions**: Announce dynamic content with `aria-live`
- [ ] **Color Contrast**: Test with axe DevTools
- [ ] **Motion**: Test with `prefers-reduced-motion` enabled
- [ ] **Screen Reader**: Test with NVDA, JAWS, or VoiceOver
- [ ] **Mobile**: Test on touch devices

## Testing Checklist

### Visual Testing
- [ ] Component renders correctly
- [ ] All variants work
- [ ] Responsive design works (mobile, tablet, desktop)
- [ ] Animations are smooth
- [ ] Text is readable

### Keyboard Testing
- [ ] Tab navigation works
- [ ] All interactive elements are reachable
- [ ] Keyboard shortcuts work (if any)
- [ ] Focus is visible and follows logical order

### Screen Reader Testing
1. Enable screen reader:
   - **Mac**: Command + F5 (VoiceOver)
   - **Windows**: NVDA (free) or JAWS (commercial)
   - **Linux**: Orca
2. Navigate component with arrow keys and Tab
3. Verify announcements are clear and helpful

### Accessibility Validation
```bash
# Install axe DevTools browser extension
# Right-click on component → Inspect with axe DevTools
# Review violations and auto-checks
```

## Customization

### Change Colors (Dark Theme Alternative)

Edit `src/styles/design-tokens.css`:

```css
:root {
  /* Slightly lighter background */
  --bg: #1a1a1a;
  --bg-100: #222222;
  
  /* Adjust glass transparency */
  --surface: rgba(255,255,255,0.08);
  --surface-2: rgba(255,255,255,0.05);
  
  /* Adjust borders */
  --glass-border: rgba(255,255,255,0.12);
  --glass-highlight: rgba(255,255,255,0.10);
}
```

### Add New Animation

1. Add keyframes to `design-tokens.css`:
```css
@keyframes slide-left {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

2. Add to `tailwind.config.js`:
```ts
animation: {
  'slide-left': 'slide-left 0.22s ease-glass',
}
```

3. Use in components:
```tsx
className="animate-slide-left"
```

### Adjust Motion Speed

Edit `tailwind.config.js`:
```ts
'--motion-fast': '100ms',    // was 120ms
'--motion-normal': '200ms',  // was 220ms
'--ease-glass': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
```

## Performance Tips

### Code Splitting
```tsx
import { lazy, Suspense } from 'react';

const ComponentGallery = lazy(() => import('./components/ComponentGallery'));

// Use with Suspense
<Suspense fallback={<Loading />}>
  <ComponentGallery />
</Suspense>
```

### Image Optimization
```tsx
// Use Next.js Image component if available
// Or compress images before adding
// Recommended: WebP format

<img
  src="avatar.webp"
  alt="User avatar"
  loading="lazy"
  width={40}
  height={40}
/>
```

### CSS Optimization
- Design tokens are minimal (~200 lines)
- Tailwind JIT purges unused classes
- Components use CSS variables (no CSS-in-JS overhead)
- Backdrop filter is hardware-accelerated

## Troubleshooting

### Glass effect not working
```
Problem: Components look flat, no blur effect
Solution: Check browser support for backdrop-filter
         Enable GPU acceleration in browser
         Test in Chrome/Edge (best support)
```

### Motion animations jittery
```
Problem: Animations stutter
Solution: Check if GPU acceleration is enabled
         Reduce number of animations
         Use transform/opacity instead of position changes
```

### Accessibility validation fails
```
Problem: ARIA labels missing
Solution: Run axe DevTools
         Check COMPONENT_DOCS.md accessibility section
         Use aria-label, aria-describedby, role attributes
```

### Colors too subtle
```
Problem: Hard to read in low light
Solution: Increase glass opacity in design-tokens.css
         Add high-contrast mode styles
         Test with Windows High Contrast mode enabled
```

## Deployment Checklist

- [ ] All components tested in browser
- [ ] Keyboard navigation verified
- [ ] Screen reader tested
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Mobile responsive design works
- [ ] Color contrast meets WCAG AA
- [ ] No console errors/warnings
- [ ] CSS is minified and optimized
- [ ] Images are optimized
- [ ] Performance budget met

---

**Next Steps:**
1. View ComponentGallery
2. Integrate MainLayout into your app
3. Connect to backend APIs
4. Customize colors/spacing as needed
5. Test accessibility
6. Deploy!
