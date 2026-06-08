import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../utils/theme';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import Composer from './Composer';
import TypingIndicator from './TypingIndicator';
import Modal from './Modal';
import ToastContainer from './Toast';
import { useToast } from '../hooks/useToast';

import ChromeButton from './ChromeButton';
import Avatar from './Avatar';
import { Video, Phone, Search } from 'lucide-react';

interface Room {
  id: string;
  name: string;
  avatar?: string;
  unread: number;
  snippet?: string;
  timestamp?: string;
  isOnline?: boolean;
}

interface Message {
  id: string;
  roomId: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  timestamp: Date | string;
  status?: 'sent' | 'delivered' | 'read';
  isOwn: boolean;
  reactions?: Array<{
    emoji: string;
    count: number;
    by: string[];
  }>;
}

const MainLayout: React.FC = () => {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('room-1');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { toasts, dismissToast, success } = useToast();

  // Mock rooms
  const rooms: Room[] = [
    {
      id: 'room-1',
      name: 'Design Team',
      unread: 3,
      snippet: 'Let me review the designs...',
      timestamp: '2:45 PM',
      isOnline: true,
    },
    {
      id: 'room-2',
      name: 'Frontend Dev',
      unread: 0,
      snippet: 'Great work on the component refactor!',
      timestamp: 'Yesterday',
      isOnline: true,
    },
    {
      id: 'room-3',
      name: 'General',
      unread: 12,
      snippet: 'Anyone free for a quick sync?',
      timestamp: '10:30 AM',
      isOnline: false,
    },
  ];

  // Mock messages
  const messages: Message[] = [
    {
      id: 'msg-1',
      roomId: 'room-1',
      sender: {
        id: 'user-2',
        name: 'Sarah',
      },
      content: 'Hey! Can you check the latest designs?',
      timestamp: new Date(Date.now() - 5 * 60000),
      status: 'read',
      isOwn: false,
    },
    {
      id: 'msg-2',
      roomId: 'room-1',
      sender: {
        id: 'user-1',
        name: 'You',
      },
      content: 'Sure! I\'ll review them now.',
      timestamp: new Date(Date.now() - 3 * 60000),
      status: 'read',
      isOwn: true,
      reactions: [
        {
          emoji: '👍',
          count: 1,
          by: ['Sarah'],
        },
      ],
    },
    {
      id: 'msg-3',
      roomId: 'room-1',
      sender: {
        id: 'user-2',
        name: 'Sarah',
      },
      content: 'Let me review the designs and get back to you with feedback.',
      timestamp: new Date(Date.now() - 1 * 60000),
      status: 'delivered',
      isOwn: false,
    },
  ];

  const currentRoom = rooms.find((r) => r.id === selectedRoomId);
  const roomMessages = messages.filter((m) => m.roomId === selectedRoomId);

  const handleSendMessage = useCallback(
    (content: string) => {
      success(`Message sent: "${content.slice(0, 20)}..."`);
      console.log('Send message:', content);
    },
    [success]
  );

  const handleRoomSelect = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <div className="h-screen w-full flex overflow-hidden">
      {/* Sidebar - Collapsible with AnimatePresence/Motion */}
      <motion.div
        initial={{ width: 320, opacity: 1 }}
        animate={{
          width: isSidebarOpen ? 320 : 0,
          opacity: isSidebarOpen ? 1 : 0
        }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className={cn(
          'hidden md:flex flex-shrink-0 h-full overflow-hidden',
          'bg-mono-bg/40 backdrop-blur-glass border-r border-mono-glass-border',
          'flex-col'
        )}
      >
        <div className="w-80 h-full"> {/* Inner container to prevent squishing */}
          <Sidebar
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            onRoomSelect={handleRoomSelect}
            onToggleSidebar={() => setIsSidebarOpen(false)}
          />
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <div
          className={cn(
            'flex-shrink-0 h-16 px-4 py-3',
            'bg-mono-bg/40 backdrop-blur-glass border-b border-mono-glass-border',
            'flex items-center justify-between gap-2',
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Toggle Sidebar Button (Only visible when sidebar is closed) */}
            {!isSidebarOpen && (
              <ChromeButton
                onClick={() => setIsSidebarOpen(true)}
                variant="circle"
                className="hidden md:flex p-2 min-h-[40px] min-w-[40px] items-center justify-center text-mono-text mr-2 animate-fade-in"
                title="Open Sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </ChromeButton>
            )}

            {/* Mobile Menu Toggle */}
            <ChromeButton
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={cn(
                'md:hidden p-2 rounded-glass',
                'bg-mono-surface hover:bg-mono-surface/80',
                'border border-mono-glass-border hover:border-mono-glass-highlight',
                'text-mono-text hover:text-mono-text',
                'transition-all duration-fast ease-glass',
                'min-h-[40px] min-w-[40px] flex items-center justify-center'
              )}
              aria-label="Toggle menu"
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </ChromeButton>

            {/* Room Name */}
            <div className="flex items-center gap-3 min-w-0">
              <Avatar src={currentRoom?.avatar} name={currentRoom?.name} size="md" isOnline={currentRoom?.isOnline} />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-mono-text truncate">
                  {currentRoom?.name}
                </h2>
                <p className="text-xs text-mono-muted truncate">
                  {currentRoom?.isOnline ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex gap-2 flex-shrink-0">
            <ChromeButton
              variant="circle"
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-mono-muted hover:text-mono-text"
              aria-label="Video Call"
            >
              <Video className="w-5 h-5" />
            </ChromeButton>
            <ChromeButton
              variant="circle"
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-mono-muted hover:text-mono-text"
              aria-label="Voice Call"
            >
              <Phone className="w-5 h-5" />
            </ChromeButton>
            <ChromeButton
              variant="circle"
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-mono-muted hover:text-mono-text"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </ChromeButton>
          </div>
        </div>

        {/* Messages */}
        <MessageList
          messages={roomMessages}
          roomName={currentRoom?.name}
          className="flex-1"
        />

        {/* Typing Indicator */}
        <div className="px-4 py-1">
          <TypingIndicator
            users={[
              {
                id: 'user-2',
                name: 'Sarah',
              },
            ]}
          />
        </div>

        {/* Composer */}
        <Composer
          onSendMessage={handleSendMessage}
          placeholder="Type a message..."
          onAttachmentSelect={(type) => console.log('Attachment selected:', type)}
          isSidebarOpen={isSidebarOpen}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className={cn(
            'fixed inset-0 z-40 md:hidden',
            'bg-mono-bg/80 backdrop-blur-glass',
            'animate-fade-up'
          )}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className={cn(
              'absolute inset-y-0 left-0 w-80',
              'bg-mono-bg border-r border-mono-glass-border',
              'shadow-lg',
              'animate-slide-right'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              rooms={rooms}
              selectedRoomId={selectedRoomId}
              onRoomSelect={handleRoomSelect}
            />
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        title="Create New Room"
        onClose={() => setIsModalOpen(false)}
        onConfirm={() => {
          setIsModalOpen(false);
          success('Room created successfully!');
        }}
        confirmText="Create"
        contentClassName="space-y-4"
      >
        <input
          type="text"
          placeholder="Room name"
          className={cn(
            'w-full px-3 py-2 rounded-glass',
            'bg-mono-surface-2 border border-mono-glass-border',
            'text-mono-text placeholder-mono-muted',
            'focus:outline-none focus:ring-2 focus:ring-mono-glass-highlight/50 focus:border-mono-glass-highlight',
            'transition-all duration-fast ease-glass'
          )}
        />
        <textarea
          placeholder="Room description (optional)"
          rows={3}
          className={cn(
            'w-full px-3 py-2 rounded-glass resize-none',
            'bg-mono-surface-2 border border-mono-glass-border',
            'text-mono-text placeholder-mono-muted',
            'focus:outline-none focus:ring-2 focus:ring-mono-glass-highlight/50 focus:border-mono-glass-highlight',
            'transition-all duration-fast ease-glass'
          )}
        />
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

export default MainLayout;
