import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, SPACE_TONES } from '../utils/theme';
import { MessageSquare, UserPlus, Users, Menu, Plus, Lock } from 'lucide-react';
import ChromeButton from './ChromeButton';
import SettingsMenu from './SettingsMenu';
import Avatar from './Avatar';
import CreateSpaceModal from './CreateSpaceModal';
import ConstellationModal from './ConstellationModal';
import SearchUsers from './Connect/SearchUsers';
import RequestList from './Connect/RequestList';
import AetherLogo from './AetherLogo';

interface Room {
  id: string;
  name: string;
  avatar?: string;
  unread: number;
  snippet?: string;
  timestamp?: string;
  isOnline?: boolean;
  isMuted?: boolean;
  room_type?: 'direct' | 'group';
  tone?: string;
}

interface SidebarProps {
  rooms: Room[];
  selectedRoomId?: string;
  lockedRoomIds?: number[];
  currentUser?: {
    username: string;
    displayName?: string;
    email?: string;
    avatar?: string;
  };
  onRoomSelect: (roomId: string) => void;
  onLockedRoomClick?: (roomId: string, roomName: string) => void;
  onToggleSidebar?: () => void;
  onSpaceCreated?: (space: any) => void;
  onUpdateProfile?: (updates: any) => void;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  rooms,
  selectedRoomId,
  lockedRoomIds = [],
  currentUser,
  onRoomSelect,
  onLockedRoomClick,
  onToggleSidebar,
  onSpaceCreated,
  onUpdateProfile,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'search' | 'requests'>('chats');
  const [isCreateSpaceOpen, setIsCreateSpaceOpen] = useState(false);
  const [isConstellationOpen, setIsConstellationOpen] = useState(false);

  return (
    <nav
      className={cn(
        'flex flex-col h-full w-full bg-mono-bg',
        'border-r border-mono-glass-border',
        className
      )}
      role="navigation"
      aria-label="Sidebar"
    >
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-mono-glass-border">
        <div className="flex items-center justify-between gap-2 mb-4">
          <AetherLogo size="sm" />
          <ChromeButton
            variant="circle"
            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-mono-muted hover:text-mono-text md:flex"
            aria-label="Menu"
            onClick={onToggleSidebar}
          >
            <Menu className="w-4 h-4" />
          </ChromeButton>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-[#2a2a2c] rounded-2xl">
          <button
            onClick={() => setActiveTab('chats')}
            className={cn(
              'flex-1 flex items-center justify-center py-1.5 px-4 rounded-xl text-xs font-medium transition-all duration-200 z-10',
              activeTab === 'chats'
                ? 'bg-[#1a1a1c] text-mono-text shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
                : 'text-mono-muted hover:text-mono-text'
            )}
            title="Chats"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={cn(
              'flex-1 flex items-center justify-center py-1.5 px-4 rounded-xl text-xs font-medium transition-all duration-200 z-10',
              activeTab === 'requests'
                ? 'bg-[#1a1a1c] text-mono-text shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
                : 'text-mono-muted hover:text-mono-text'
            )}
            title="Requests"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={cn(
              'flex-1 flex items-center justify-center py-1.5 px-4 rounded-xl text-xs font-medium transition-all duration-200 z-10',
              activeTab === 'search'
                ? 'bg-[#1a1a1c] text-mono-text shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
                : 'text-mono-muted hover:text-mono-text'
            )}
            title="Find Users"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        <AnimatePresence mode="wait">
          {activeTab === 'chats' && (
            <motion.div
              key="chats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="h-full"
            >
              <ul role="list" aria-label="Chat room list" className="h-full">
                {rooms.length === 0 ? (
                  <li className="flex items-center justify-center h-full p-4">
                    <div className="text-center">
                      <p className="text-mono-muted text-sm mb-3">No chats yet</p>
                      <button
                        onClick={() => setActiveTab('search')}
                        className="text-accent-primary hover:text-accent-primary-hover text-sm font-medium"
                      >
                        Find someone to chat with
                      </button>
                    </div>
                  </li>
                ) : (
                  <>
                    {/* Header with Create Space */}
                    <div className="px-5 py-2 flex items-center justify-between group mt-2">
                      <span className="text-[10px] font-bold text-mono-muted tracking-widest uppercase">Conversations</span>
                      <button
                        onClick={() => setIsCreateSpaceOpen(true)}
                        className="p-1 rounded-md text-mono-muted hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Create Space"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {rooms.map((room) => {
                      const isLocked = lockedRoomIds.includes(parseInt(room.id));
                      return (
                        <li key={room.id} role="listitem">
                          <button
                            onClick={() => {
                              if (isLocked) {
                                onLockedRoomClick?.(room.id, room.name);
                              } else {
                                onRoomSelect(room.id);
                              }
                            }}
                            className={cn(
                              'w-[calc(100%-16px)] px-3 py-2 m-2 mt-0 mb-1 rounded-glass block relative',
                              'transition-all duration-normal ease-glass',
                              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-mono-text/50',
                              selectedRoomId === room.id
                                ? 'bg-mono-surface border border-mono-glass-highlight shadow-glass-sm'
                                : 'hover:bg-mono-surface/40 border border-transparent hover:border-mono-glass-border',
                              'active:scale-98',
                              'min-h-[64px] flex items-center gap-3',
                              // Tone-specific subtle background if selected
                              selectedRoomId === room.id && room.tone && SPACE_TONES[room.tone]
                                ? SPACE_TONES[room.tone].bg.replace('/5', '/10')
                                : ''
                            )}
                          >
                            <div className={cn(
                              "flex-shrink-0 relative",
                              room.room_type === 'group' ? "rounded-lg" : "rounded-full"
                            )}>
                              <Avatar
                                src={room.avatar}
                                name={room.name}
                                size="lg"
                                isOnline={room.isOnline}
                                className={cn(
                                  room.room_type === 'group' ? "rounded-lg" : "",
                                  room.tone && SPACE_TONES[room.tone] ? SPACE_TONES[room.tone].border : ''
                                )}
                              />
                              {/* Soft Presence Pulse for Spaces */}
                              {room.room_type === 'group' && room.tone && SPACE_TONES[room.tone] && (room.unread > 0 || room.isOnline) && (
                                <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                                  <span className={cn(
                                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                    room.tone === 'social' ? 'bg-blue-400' :
                                      room.tone === 'focus' ? 'bg-purple-400' :
                                        room.tone === 'work' ? 'bg-amber-400' : 'bg-emerald-400'
                                  )}></span>
                                  <span className={cn(
                                    "relative inline-flex rounded-full h-3 w-3 border-2 border-mono-bg",
                                    room.tone === 'social' ? 'bg-blue-500' :
                                      room.tone === 'focus' ? 'bg-purple-500' :
                                        room.tone === 'work' ? 'bg-amber-500' : 'bg-emerald-500'
                                  )}></span>
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center justify-between mb-0.5">
                                <h3 className={cn(
                                  "text-sm font-semibold truncate transition-colors",
                                  selectedRoomId === room.id && room.tone && SPACE_TONES[room.tone] ? SPACE_TONES[room.tone].color : "text-mono-text"
                                )}>{room.name}</h3>
                                {room.timestamp && <span className="text-[10px] text-mono-muted">{room.timestamp}</span>}
                              </div>
                              <div className="flex items-center justify-between">
                                <p className={cn("text-xs truncate max-w-[140px]", room.unread > 0 ? "text-mono-text font-medium" : "text-mono-muted")}>
                                  {room.snippet || (room.room_type === 'group' ? (
                                    room.tone === 'focus' ? 'Focusing...' :
                                      room.tone === 'social' ? 'Hanging out...' :
                                        room.tone === 'work' ? 'Collaborating...' : 'Quiet...'
                                  ) : 'Start chatting...')}
                                </p>
                                {room.unread > 0 && (
                                  <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-white text-black text-[10px] font-bold px-1">
                                    {room.unread > 99 ? '99+' : room.unread}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Lock Icon Overlay */}
                            {isLocked && (
                              <div className="absolute inset-0 flex items-center justify-center bg-mono-bg/80 backdrop-blur-sm rounded-glass z-10 transition-all duration-300">
                                <Lock className="w-5 h-5 text-amber-400 drop-shadow-glow" />
                              </div>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </>
                )}
              </ul>
            </motion.div>
          )}

          {activeTab === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="h-full"
            >
              <SearchUsers />
            </motion.div>
          )}

          {activeTab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="h-full"
            >
              <RequestList />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Profile */}
      <div className="flex-shrink-0 p-3 border-t border-mono-glass-border">
        <div className="flex items-center gap-3 px-2">
          <Avatar size="sm" name={currentUser?.displayName || currentUser?.username || "My Profile"} src={currentUser?.avatar} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-mono-text truncate">
              {currentUser?.displayName || currentUser?.username || "My Profile"}
            </p>
            {currentUser?.username && (
              <p className="text-[10px] text-mono-muted truncate">@{currentUser.username}</p>
            )}
          </div>
          <SettingsMenu
            user={{
              name: currentUser?.displayName || currentUser?.username || "My Profile",
              username: currentUser?.username,
              email: currentUser?.email,
              avatar: currentUser?.avatar
            }}
            onLogout={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user'); // Clear user data
              window.location.reload();
            }}
            onConstellations={() => setIsConstellationOpen(true)}
            onUpdateProfile={onUpdateProfile}
          />
        </div>
      </div>

      <CreateSpaceModal
        isOpen={isCreateSpaceOpen}
        onClose={() => setIsCreateSpaceOpen(false)}
        onSpaceCreated={(space) => onSpaceCreated?.(space)}
      />
      <ConstellationModal
        isOpen={isConstellationOpen}
        onClose={() => setIsConstellationOpen(false)}
      />
    </nav >
  );
};

export default Sidebar;
