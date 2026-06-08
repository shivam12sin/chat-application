import React, { useState } from 'react';
import { cn, formatTimestamp, getStatusAriaLabel, getAriaLabel } from '../utils/theme';
import { highlightText } from '../utils/search';
import ChromeButton from './ChromeButton';
import ResonanceCard from './ResonanceCard';
import AetherWaves from './AetherWaves';
import MessageOptionsMenu from './MessageOptionsMenu';
import EmojiPickerWrapper from './EmojiPickerWrapper';
import { getRecentEmojis, addRecentEmoji } from '../api/reactions';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

export interface Message {
  id: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file' | 'poll' | 'location' | 'gif' | 'sticker' | 'youtube';
  metadata?: any;
  timestamp: Date | string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isOwn: boolean;
  reactions?: Array<{
    emoji: string;
    count: number;
    by: string[];
  }>;
}

interface MessageItemProps {
  message: Message;
  searchQuery?: string;
  roomId?: number;
  onPollVote?: (pollId: string, optionIndex: number) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string, mode: 'me' | 'everyone') => void;
  onPin?: (messageId: string) => void;
  onConstellation?: (messageId: string, roomId: number) => void;
  onReply?: (messageId: string, senderName: string, content: string) => void;
  onForward?: (messageId: string, content: string) => void;
  onSelect?: (messageId: string) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (messageId: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, searchQuery, roomId, onPollVote, onReaction, onDelete: _onDelete, onPin, onConstellation, onReply, onForward, onSelect, isSelectMode = false, isSelected = false, onToggleSelect }) => {
  const [showOptions, setShowOptions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(getRecentEmojis());
  const timestamp = formatTimestamp(message.timestamp);

  const handleReaction = (emoji: string) => {
    // Update recent emojis in localStorage
    const updated = addRecentEmoji(emoji);
    setRecentEmojis(updated);

    // Call the reaction handler from parent
    if (onReaction) {
      onReaction(message.id, emoji);
    }

    setShowEmojiPicker(false);
  };

  const renderContent = () => {
    switch (message.messageType) {
      case 'image':
      case 'gif':
      case 'sticker':
        return (
          <div className="relative group/image">
            <img
              src={message.metadata?.url || message.content}
              alt="Attachment"
              className="max-w-full rounded-lg max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.metadata?.url || message.content, '_blank')}
            />
          </div>
        );
      case 'video':
        return (
          <video
            src={message.metadata?.url || message.content}
            controls
            className="max-w-full rounded-lg max-h-[300px]"
          />
        );
      case 'audio':
        return (
          <AetherWaves
            audioUrl={message.metadata?.url || message.content}
            fileName={message.metadata?.originalName || 'Audio File'}
          />
        );
      case 'file':
        return (
          <a
            href={message.metadata?.url || message.content}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-mono-surface-2 rounded-lg hover:bg-mono-surface-3 transition-colors group/file"
          >
            <div className="p-2 bg-mono-glass-highlight/20 rounded-full text-mono-glass-highlight">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-mono-text truncate">
                {message.metadata?.originalName || 'Document'}
              </p>
              <p className="text-xs text-mono-muted">
                {message.metadata?.size ? `${(message.metadata.size / 1024).toFixed(1)} KB` : 'Download'}
              </p>
            </div>
            <svg className="w-5 h-5 text-mono-muted group-hover/file:text-mono-text transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        );
      case 'poll':
        const pollData = message.metadata;
        const totalVotes = pollData?.options.reduce((acc: number, opt: any) => acc + (opt.votes || 0), 0) || 0;

        return (
          <div className="min-w-[250px] space-y-2">
            <h4 className="font-medium text-mono-text mb-2">{pollData?.question}</h4>
            {pollData?.options.map((option: any, index: number) => {
              const percentage = totalVotes > 0 ? Math.round(((option.votes || 0) / totalVotes) * 100) : 0;
              // const isVoted = false; // TODO: Check if current user voted

              return (
                <button
                  key={index}
                  onClick={() => onPollVote?.(message.id, index)}
                  className="w-full relative overflow-hidden rounded-lg border border-mono-glass-border hover:border-mono-glass-highlight transition-colors group/poll"
                  disabled={false} // TODO: Handle already voted logic if single choice
                >
                  <div
                    className="absolute inset-0 bg-mono-glass-highlight/10 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                  <div className="relative p-2 flex justify-between items-center z-10">
                    <span className="text-sm text-mono-text">{option.text}</span>
                    <span className="text-xs text-mono-muted font-medium">{percentage}%</span>
                  </div>
                </button>
              );
            })}
            <div className="text-xs text-mono-muted text-right mt-1">
              {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
            </div>
          </div>
        );
      case 'location':
        const { lat, lng } = message.metadata || {};
        const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`;

        return (
          <div className="min-w-[250px] rounded-lg overflow-hidden border border-mono-glass-border">
            <iframe
              width="100%"
              height="150"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={mapUrl}
              className="bg-mono-surface-2"
            />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-2 text-xs text-center bg-mono-surface hover:bg-mono-surface-2 text-mono-glass-highlight transition-colors"
            >
              Open in Maps
            </a>
          </div>
        );
      case 'youtube':
        return (
          <ResonanceCard
            videoId={message.metadata?.videoId}
            title={message.metadata?.title}
            channelTitle={message.metadata?.channelTitle}
            thumbnailUrl={message.metadata?.thumbnail}
          />
        );
      default: {
        // Check if this is a forwarded message
        const isForwarded = message.metadata?.forwarded || message.content.startsWith('[Forwarded]');
        const displayContent = message.content.replace(/^\[Forwarded\]\s*/, '');

        // Check if this is a reply to another message
        const replyTo = message.metadata?.replyTo;

        return (
          <div>
            {/* Reply-to preview - clickable to jump to original */}
            {replyTo && (
              <div
                className="flex items-start gap-2 mb-2 p-2 bg-zinc-700/40 rounded-lg border-l-2 border-blue-500 cursor-pointer hover:bg-zinc-700/60 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  const targetElement = document.getElementById(`message-${replyTo.messageId}`);
                  if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Highlight effect
                    targetElement.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-75');
                    setTimeout(() => {
                      targetElement.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-75');
                    }, 2000);
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-blue-400 font-medium">{replyTo.senderName || 'Message'}</div>
                  <div className="text-xs text-zinc-400 truncate">{replyTo.content || '...'}</div>
                </div>
              </div>
            )}
            {/* Forwarded label */}
            {isForwarded && (
              <div className="flex items-center gap-1.5 mb-1 text-xs text-zinc-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
                <span className="italic">Forwarded</span>
              </div>
            )}
            <p className="text-sm text-mono-text whitespace-pre-wrap break-words leading-normal">
              {searchQuery ? highlightText(displayContent, searchQuery) : displayContent}
            </p>
          </div>
        );
      }
    }
  };

  return (
    <div
      id={`message-${message.id}`}
      className={cn(
        'flex gap-2 group',
        message.isOwn && 'flex-row-reverse',
        isSelectMode && 'cursor-pointer'
      )}
      role="article"
      aria-label={getAriaLabel(
        message.sender.name,
        timestamp,
        message.messageType === 'text' ? message.content : `Sent a ${message.messageType}`
      )}
      onClick={isSelectMode ? () => onToggleSelect?.(message.id) : undefined}
    >
      {/* Selection Checkbox - Only in select mode */}
      {isSelectMode && (
        <div className="flex-shrink-0 flex items-center justify-center w-6">
          <div
            className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
              isSelected
                ? 'bg-blue-500 border-blue-500'
                : 'border-mono-muted bg-transparent hover:border-blue-400'
            )}
          >
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8">
        {message.sender.avatar ? (
          <img
            src={message.sender.avatar}
            alt={`${message.sender.name}'s avatar`}
            className="w-full h-full rounded-glass object-cover border border-mono-glass-border"
          />
        ) : (
          <div
            className={cn(
              'w-full h-full rounded-glass',
              'bg-mono-surface-2 border border-mono-glass-border',
              'flex items-center justify-center',
              'text-mono-muted text-xs font-medium'
            )}
          >
            {message.sender.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className={cn('flex flex-col gap-1 max-w-[360px]', message.isOwn && 'items-end')}>
        {/* Sender name (for received messages) */}
        {!message.isOwn && (
          <div className="px-3 py-1 text-xs font-medium text-mono-muted">
            {message.sender.name}
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={cn(
            'px-3 py-2 rounded-glass',
            'backdrop-blur-glass border',
            'transition-all duration-normal ease-glass',
            'group-hover:shadow-glass-sm',
            message.isOwn
              ? 'bg-mono-surface border-mono-glass-highlight'
              : 'bg-mono-surface/50 border-mono-glass-border',
            message.status === 'failed' && 'border-white/40 bg-white/5',
            (message.messageType === 'image' || message.messageType === 'gif' || message.messageType === 'sticker') && 'p-1 bg-transparent border-none shadow-none'
          )}
        >
          {renderContent()}

          {/* Timestamp and Status */}
          <div
            className={cn(
              'flex items-center gap-1 mt-1',
              'text-xs text-mono-muted',
              (message.messageType === 'image' || message.messageType === 'gif') && 'text-white drop-shadow-md absolute bottom-2 right-2'
            )}
          >
            <span>{timestamp}</span>
            {message.isOwn && message.status && (
              <div
                aria-label={getStatusAriaLabel(message.status)}
                title={getStatusAriaLabel(message.status)}
              >
                {message.status === 'sending' && (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {message.status === 'failed' && (
                  <svg className="w-3.5 h-3.5 text-mono-text/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {message.status === 'sent' && (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {message.status === 'delivered' && (
                  <div className="flex gap-0.5">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <svg className="w-3 h-3 -ml-1.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {message.status === 'read' && (
                  <div className="flex gap-0.5 text-white shadow-glow-sm">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <svg className="w-3 h-3 -ml-1.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex gap-1 flex-wrap px-1">
            {message.reactions.map((reaction, idx) => (
              <button
                key={idx}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs',
                  'bg-mono-surface/40 border border-mono-glass-border',
                  'hover:bg-mono-surface/60 hover:border-mono-glass-highlight',
                  'transition-all duration-fast ease-glass',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-mono-text/50',
                  'active:scale-95'
                )}
                title={`${reaction.count} people reacted with ${reaction.emoji}`}
                aria-label={`${reaction.count} people reacted with ${reaction.emoji}`}
              >
                <span>{reaction.emoji}</span>
                <span className="ml-1 text-mono-muted">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Hover Actions - Inline Reaction Bar */}
        <div
          className={cn(
            'flex gap-1 opacity-0 group-hover:opacity-100',
            'transition-opacity duration-fast',
            'px-1'
          )}
        >
          {/* Quick React - Recent Emojis */}
          {recentEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                'bg-transparent hover:bg-mono-surface/80',
                'text-lg transition-all hover:scale-110'
              )}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          {/* Plus Button for Full Picker */}
          <div className="relative">
            <ChromeButton
              variant="circle"
              className={cn(
                "p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center",
                showEmojiPicker && "bg-mono-surface"
              )}
              aria-label="Add reaction"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </ChromeButton>
            <EmojiPickerWrapper
              isOpen={showEmojiPicker}
              onClose={() => setShowEmojiPicker(false)}
              onEmojiSelect={handleReaction}
              position="top"
              align={message.isOwn ? "right" : "left"}
            />
          </div>

          <div className="relative">
            <ChromeButton
              variant="circle"
              className="p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="More options"
              onClick={() => setShowOptions(!showOptions)}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </ChromeButton>
            <MessageOptionsMenu
              isOpen={showOptions}
              onClose={() => setShowOptions(false)}
              isOwn={message.isOwn}
              onReply={() => onReply?.(message.id, message.sender.name, message.content)}
              onConstellation={() => onConstellation?.(message.id, roomId || 0)}
              onPin={() => onPin?.(message.id)}
              onForward={() => onForward?.(message.id, message.content)}
              onCopy={() => {
                navigator.clipboard.writeText(message.content);
                console.log('Copied', message.id);
              }}
              onDeleteForMe={() => _onDelete?.(message.id, 'me')}
              onDeleteForEveryone={() => _onDelete?.(message.id, 'everyone')}
              onSelect={() => onSelect?.(message.id)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
