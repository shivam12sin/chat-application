import React, { useRef, useState, useEffect } from 'react';
import { cn, focusElement } from '../utils/theme';
import AttachmentMenu from './AttachmentMenu';
import ChromeButton from './ChromeButton';
import EmojiPickerWrapper from './EmojiPickerWrapper';
import { X } from 'lucide-react';

export interface ReplyingTo {
  messageId: string;
  senderName: string;
  content: string;
}

interface ComposerProps {
  onSendMessage: (content: string, replyToId?: string) => void;
  onAttachmentSelect: (type: 'image' | 'video' | 'file' | 'poll' | 'location' | 'gif' | 'music' | 'schedule') => void;
  onContentChange?: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  isSidebarOpen?: boolean;
  replyingTo?: ReplyingTo | null;
  onCancelReply?: () => void;
}


const Composer: React.FC<ComposerProps> = ({
  onSendMessage,
  onAttachmentSelect,
  onContentChange,
  isLoading = false,
  placeholder = 'Type a message...',
  className,
  isSidebarOpen = true,
  replyingTo,
  onCancelReply,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isCompact = !isSidebarOpen && !isExpanded;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Auto-expand textarea and notify parent of content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
    if (onContentChange) {
      onContentChange(content);
    }
  }, [content, onContentChange]);

  const handleSubmit = () => {
    if (content.trim() && !isLoading) {
      onSendMessage(content.trim(), replyingTo?.messageId);
      setContent('');
      onCancelReply?.(); // Clear reply state after sending

      // Cosmic Ripple Effect
      window.dispatchEvent(new CustomEvent('cosmic:input'));

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        focusElement(textareaRef.current);
      }
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + emoji + content.substring(end);
      setContent(newContent);
      // Move cursor after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setContent(prev => prev + emoji);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends message (without modifier keys)
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Ctrl/Cmd + Enter inserts a newline
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = content.substring(0, start) + '\n' + content.substring(end);
        setContent(newValue);
        // Set cursor position after the newline
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1;
        }, 0);
      }
    }
    // Allow Shift + Enter for newline
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      const start = textareaRef.current?.selectionStart || 0;
      const end = textareaRef.current?.selectionEnd || 0;
      const newContent = content.substring(0, start) + '\n' + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1;
        }
      }, 0);
    }
  };

  return (
    <div
      className={cn(
        'flex-shrink-0 p-4 pb-6', /* Added padding bottom for spacing */
        'bg-mono-bg',
        className
      )}
      role="region"
      aria-label="Message composer"
    >
      {/* Hint */}
      {/* Hint removed */}

      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="max-w-4xl mx-auto mb-2 flex items-center gap-3 px-4 py-2.5 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700/50 rounded-xl">
          <div className="w-1 h-8 bg-blue-500 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-blue-400 font-medium">{replyingTo.senderName}</div>
            <div className="text-xs text-zinc-400 truncate">{replyingTo.content}</div>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1.5 hover:bg-zinc-700 rounded-full transition-colors"
            aria-label="Cancel reply"
          >
            <X className="w-4 h-4 text-zinc-400 hover:text-white" />
          </button>
        </div>
      )}

      {/* Floating Composer Container */}
      <div
        className={cn(
          "flex items-end mx-auto w-full transition-all duration-500 ease-in-out",
          isCompact ? "max-w-[200px] gap-0" : "max-w-4xl gap-4"
        )}
        onClick={() => !isSidebarOpen && setIsExpanded(true)}
      >
        {/* The Pill: Attachment + Input + Emoji */}
        <div
          className={cn(
            'relative flex-1 flex gap-2 items-end',
            'backdrop-blur-glass bg-mono-surface border',
            'transition-all duration-500 ease-in-out',
            isCompact ? 'px-4 py-2 rounded-full justify-center cursor-pointer hover:bg-mono-surface/80' : 'px-3 py-1.5 rounded-3xl',
            isFocused || isCompact
              ? 'border-mono-glass-highlight shadow-glass-md'
              : 'border-mono-glass-border hover:border-mono-glass-highlight/50'
          )}
        >
          {/* Attachment Menu (Left) - Hidden in compact */}
          <div className={cn("transition-all duration-300", isCompact ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100")}>
            <AttachmentMenu onSelect={onAttachmentSelect} className="flex-shrink-0" />
          </div>

          {/* Textarea (Center) */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsFocused(true);
              if (!isSidebarOpen) setIsExpanded(true);
            }}
            onBlur={() => {
              setIsFocused(false);
              // Optional: We could auto-collapse on blur if empty, but user didn't explicitly ask. 
              // Let's keep it expanded if it has content, or if user manually closes sidebar?
              // The prompt implies it "becomes small" when sidebar IS collapsed.
              // So if I expand it, does it stay expanded? 
              // "they reappear when the compose pill is clicked and it becomes like it is now"
              // It probably stays that way while typing.
              // If I click away? Maybe collapse?
              if (!content.trim() && !isSidebarOpen) setIsExpanded(false);
            }}
            placeholder={isCompact ? "Type..." : placeholder}
            disabled={isLoading}
            rows={1}
            className={cn(
              'flex-1 bg-transparent text-mono-text placeholder-mono-muted',
              'border-0 outline-0 resize-none',
              'text-sm leading-normal',
              'max-h-[120px] min-h-[36px] py-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isCompact && "text-center cursor-pointer pb-0"
            )}
            aria-label="Message content"
            aria-describedby="composer-hint"
          />

          {/* Emoji Button (Right inside pill) - Hidden in compact */}
          <div className={cn("relative transition-all duration-300", isCompact ? "w-0 opacity-0 overflow-hidden" : "w-[36px] opacity-100")}>
            <ChromeButton
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              variant="circle"
              className={cn(
                "flex-shrink-0 min-h-[36px] min-w-[36px] text-mono-muted hover:text-mono-text",
                showEmojiPicker && "text-mono-text bg-mono-surface"
              )}
              aria-label="Emoji picker"
              title="Emoji picker"
              disabled={isLoading}
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
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </ChromeButton>
          </div>

          {/* Emoji Picker - positioned relative to the pill, not the button */}
          <EmojiPickerWrapper
            isOpen={showEmojiPicker}
            onClose={() => setShowEmojiPicker(false)}
            onEmojiSelect={handleEmojiSelect}
            position="top"
            align="right"
            className="absolute right-0 bottom-full mb-2"
          />
        </div>

        {/* Send Button (Floating Outside Right) - Hidden in compact */}
        <div className={cn("transition-all duration-300 transform", isCompact ? "scale-0 w-0 opacity-0" : "scale-100 w-[48px] opacity-100")}>
          <ChromeButton
            onClick={handleSubmit}
            disabled={!content.trim() || isLoading}
            variant="circle"
            className={cn(
              "flex-shrink-0 min-h-[48px] min-w-[48px] rounded-full", /* Bigger send button */
              "shadow-glass-lg"
            )}
            aria-label="Send message"
            title="Send message (Ctrl+Enter)"
          >
            {isLoading ? (
              <svg
                className="w-6 h-6 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6" /* Bigger Icon */
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
          </ChromeButton>
        </div>
      </div>

      {/* Character Counter Removed */}
    </div>
  );
};

export default Composer;
