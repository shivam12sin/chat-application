/**
 * Component Gallery
 * 
 * This file showcases all the liquid-glass theme components with various states
 * and configurations for development and documentation purposes.
 */

import React, { useState } from 'react';
import { cn } from '../utils/theme';

// Import all components
import GlassPanel from './GlassPanel';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import MessageItem from './MessageItem';
import Composer from './Composer';
import Modal from './Modal';
import ToastContainer from './Toast';
import TypingIndicator from './TypingIndicator';
import { useToast } from '../hooks/useToast';

/**
 * Component Gallery
 * 
 * A showcase of all liquid-glass components with various states.
 * Use this for:
 * - Visual verification during development
 * - Documenting component usage
 * - Testing different states and interactions
 * - Accessibility validation
 */
const ComponentGallery: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('glass-panel');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toasts, dismissToast, success, error, warning, info } = useToast();

  const tabs = [
    { id: 'glass-panel', label: 'GlassPanel' },
    { id: 'sidebar', label: 'Sidebar' },
    { id: 'messages', label: 'Messages' },
    { id: 'composer', label: 'Composer' },
    { id: 'modal', label: 'Modal' },
    { id: 'toasts', label: 'Toasts' },
    { id: 'typing', label: 'Typing' },
  ];

  const mockRooms = [
    {
      id: 'room-1',
      name: 'Design System',
      unread: 5,
      snippet: 'Great work on the components!',
      timestamp: '2:45 PM',
      isOnline: true,
    },
    {
      id: 'room-2',
      name: 'Frontend Team',
      unread: 0,
      snippet: 'Let\'s sync on the CSS architecture',
      timestamp: 'Yesterday',
      isOnline: true,
    },
  ];

  const mockMessages = [
    {
      id: 'msg-1',
      roomId: 'room-1',
      sender: { id: 'user-1', name: 'Alice' },
      content: 'The new liquid-glass aesthetic looks amazing!',
      timestamp: new Date(Date.now() - 5 * 60000),
      status: 'read' as const,
      isOwn: false,
      reactions: [{ emoji: '✨', count: 2, by: ['Bob', 'Carol'] }],
    },
    {
      id: 'msg-2',
      roomId: 'room-1',
      sender: { id: 'user-2', name: 'You' },
      content: 'Thanks! I focused on minimalism and subtle animations.',
      timestamp: new Date(Date.now() - 2 * 60000),
      status: 'delivered' as const,
      isOwn: true,
    },
  ];

  return (
    <div className="min-h-screen bg-mono-bg text-mono-text">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-mono-glass-border bg-mono-bg/80 backdrop-blur-glass">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-2">Liquid-Glass Components</h1>
          <p className="text-mono-muted">
            Complete component library with monochrome theme and accessibility
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 pb-4 border-b border-mono-glass-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 rounded-glass text-sm font-medium',
                'transition-all duration-fast ease-glass',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-mono-text/50',
                activeTab === tab.id
                  ? 'bg-mono-surface border border-mono-glass-highlight text-mono-text'
                  : 'bg-mono-surface/40 border border-transparent hover:border-mono-glass-border text-mono-muted hover:text-mono-text'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="grid gap-8">
          {/* GlassPanel Section */}
          {activeTab === 'glass-panel' && (
            <div className="space-y-6">
              <section>
                <h2 className="text-2xl font-bold mb-4">GlassPanel</h2>
                <p className="text-mono-muted mb-6">
                  Reusable glass-morphism container with three variants
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-mono-muted mb-2">Default</h3>
                    <GlassPanel variant="default">
                      <p className="text-mono-text">Default glass panel</p>
                    </GlassPanel>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-mono-muted mb-2">Elevated</h3>
                    <GlassPanel variant="elevated">
                      <p className="text-mono-text">Elevated glass panel</p>
                    </GlassPanel>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-mono-muted mb-2">Ghost</h3>
                    <GlassPanel variant="ghost">
                      <p className="text-mono-text">Ghost glass panel</p>
                    </GlassPanel>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-4">Interactive Variant</h3>
                <GlassPanel variant="default" interactive onClick={() => success('Clicked!')}>
                  <p className="text-mono-text">Click me! (hover for visual feedback)</p>
                </GlassPanel>
              </section>
            </div>
          )}

          {/* Sidebar Section */}
          {activeTab === 'sidebar' && (
            <div className="space-y-4">
              <section>
                <h2 className="text-2xl font-bold mb-4">Sidebar</h2>
                <p className="text-mono-muted mb-6">
                  Navigation with keyboard support and room management
                </p>
                <div className="border border-mono-glass-border rounded-glass overflow-hidden h-96">
                  <Sidebar
                    rooms={mockRooms}
                    selectedRoomId="room-1"
                    onRoomSelect={(id) => info(`Selected room: ${id}`)}
                  />
                </div>
              </section>
            </div>
          )}

          {/* Messages Section */}
          {activeTab === 'messages' && (
            <div className="space-y-4">
              <section>
                <h2 className="text-2xl font-bold mb-4">Message Components</h2>
                <p className="text-mono-muted mb-6">
                  MessageList and MessageItem with full interactivity
                </p>
                <div className="border border-mono-glass-border rounded-glass overflow-hidden h-96">
                  <MessageList
                    messages={mockMessages}
                    roomName="Component Gallery"
                    hasMore={true}
                    onLoadMore={() => info('Load more messages')}
                  />
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-4">Individual Message Item</h3>
                <div className="space-y-4 p-4 border border-mono-glass-border rounded-glass bg-mono-surface/40">
                  {mockMessages.map((msg) => (
                    <MessageItem key={msg.id} message={msg} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Composer Section */}
          {activeTab === 'composer' && (
            <div className="space-y-4">
              <section>
                <h2 className="text-2xl font-bold mb-4">Composer</h2>
                <p className="text-mono-muted mb-6">
                  Auto-expanding message input with keyboard shortcuts
                </p>
                <div className="border border-mono-glass-border rounded-glass overflow-hidden">
                  <Composer
                    onSendMessage={(msg) => `Sent: ${msg}`}
                    placeholder="Type a message..."
                    onAttachmentSelect={(type) => console.log('Attachment:', type)}
                  />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-medium text-mono-muted mb-2">Keyboard Shortcuts</h3>
                <GlassPanel variant="ghost">
                  <ul className="text-sm text-mono-text space-y-1">
                    <li>
                      <kbd className="px-2 py-1 bg-mono-surface rounded border border-mono-glass-border text-xs">
                        Ctrl+Enter
                      </kbd>{' '}
                      to send
                    </li>
                    <li>
                      <kbd className="px-2 py-1 bg-mono-surface rounded border border-mono-glass-border text-xs">
                        Shift+Enter
                      </kbd>{' '}
                      for new line
                    </li>
                  </ul>
                </GlassPanel>
              </section>
            </div>
          )}

          {/* Modal Section */}
          {activeTab === 'modal' && (
            <div className="space-y-4">
              <section>
                <h2 className="text-2xl font-bold mb-4">Modal</h2>
                <p className="text-mono-muted mb-6">
                  WAI-ARIA compliant modal with focus trap and keyboard navigation
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className={cn(
                    'px-4 py-2 rounded-glass',
                    'bg-mono-surface hover:bg-mono-surface/80',
                    'border border-mono-glass-border hover:border-mono-glass-highlight',
                    'text-mono-text transition-all duration-fast ease-glass',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-mono-text/50',
                    'active:scale-95 hover:translate-y-[-1px]'
                  )}
                >
                  Open Modal
                </button>
              </section>

              <section>
                <h3 className="text-sm font-medium text-mono-muted mb-2">Features</h3>
                <ul className="text-sm text-mono-text space-y-2 p-4 bg-mono-surface/40 rounded-glass">
                  <li>✓ Focus trap keeps focus inside modal</li>
                  <li>✓ ESC key closes modal</li>
                  <li>✓ Tab/Shift+Tab navigation</li>
                  <li>✓ Backdrop click closes modal</li>
                  <li>✓ Full keyboard accessibility</li>
                </ul>
              </section>
            </div>
          )}

          {/* Toasts Section */}
          {activeTab === 'toasts' && (
            <div className="space-y-4">
              <section>
                <h2 className="text-2xl font-bold mb-4">Toast Notifications</h2>
                <p className="text-mono-muted mb-6">
                  Dismissible notifications with multiple types and actions
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => success('Success message!')}
                    className={cn(
                      'px-3 py-2 rounded-glass text-sm',
                      'bg-mono-surface hover:bg-mono-surface/80 border border-mono-glass-border',
                      'text-mono-text transition-all duration-fast ease-glass'
                    )}
                  >
                    Success
                  </button>
                  <button
                    onClick={() => error('Error message!')}
                    className={cn(
                      'px-3 py-2 rounded-glass text-sm',
                      'bg-mono-surface hover:bg-mono-surface/80 border border-mono-glass-border',
                      'text-mono-text transition-all duration-fast ease-glass'
                    )}
                  >
                    Error
                  </button>
                  <button
                    onClick={() => warning('Warning message!')}
                    className={cn(
                      'px-3 py-2 rounded-glass text-sm',
                      'bg-mono-surface hover:bg-mono-surface/80 border border-mono-glass-border',
                      'text-mono-text transition-all duration-fast ease-glass'
                    )}
                  >
                    Warning
                  </button>
                  <button
                    onClick={() => info('Info message!')}
                    className={cn(
                      'px-3 py-2 rounded-glass text-sm',
                      'bg-mono-surface hover:bg-mono-surface/80 border border-mono-glass-border',
                      'text-mono-text transition-all duration-fast ease-glass'
                    )}
                  >
                    Info
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* Typing Section */}
          {activeTab === 'typing' && (
            <div className="space-y-4">
              <section>
                <h2 className="text-2xl font-bold mb-4">Typing Indicator</h2>
                <p className="text-mono-muted mb-6">
                  Shows when users are typing
                </p>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-mono-muted mb-2">Single User</h3>
                    <TypingIndicator
                      users={[{ id: 'user-1', name: 'Alice' }]}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-mono-muted mb-2">Multiple Users</h3>
                    <TypingIndicator
                      users={[
                        { id: 'user-1', name: 'Alice' },
                        { id: 'user-2', name: 'Bob' },
                        { id: 'user-3', name: 'Carol' },
                      ]}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        title="Component Gallery Modal"
        onClose={() => setIsModalOpen(false)}
        onConfirm={() => {
          setIsModalOpen(false);
          success('Modal action confirmed!');
        }}
        confirmText="Confirm"
        cancelText="Cancel"
      >
        <div className="space-y-4">
          <p>This is a modal component showcasing:</p>
          <ul className="text-sm text-mono-text space-y-2 pl-4">
            <li>• Focus trap and keyboard navigation</li>
            <li>• Backdrop click to close</li>
            <li>• ESC key to close</li>
            <li>• Full accessibility support</li>
          </ul>
        </div>
      </Modal>

      {/* Toast Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        position="top-right"
      />
    </div>
  );
};

export default ComponentGallery;
