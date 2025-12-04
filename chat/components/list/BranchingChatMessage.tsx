import { motion } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { Pencil, Highlighter, Bookmark, BookmarkCheck } from 'lucide-react';

interface ChatMessageProps {
  message: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  isStreaming?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
  onHighlight?: (text: string) => void;
  disableAnimation?: boolean;
  onBookmark?: () => void;
  isBookmarked?: boolean;
}

export function BranchingChatMessage({
  message,
  sender,
  timestamp,
  isStreaming = false,
  isCollapsed = false,
  onToggle,
  onEdit,
  onHighlight,
  disableAnimation = false,
  onBookmark,
  isBookmarked = false,
}: ChatMessageProps) {
  const words = message.split(' ');
  const [displayedWords, setDisplayedWords] = useState(disableAnimation ? words.length : 0);
  const hasAnimated = useRef(false);
  const [selectedText, setSelectedText] = useState('');
  const [showHighlightButton, setShowHighlightButton] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disableAnimation || hasAnimated.current) {
      setDisplayedWords(words.length);
      return;
    }

    if (isStreaming) {
      setDisplayedWords(words.length);
    } else {
      hasAnimated.current = true;
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex < words.length) {
          setDisplayedWords(currentIndex + 1);
          currentIndex++;
        } else {
          clearInterval(interval);
        }
      }, 80);

      return () => clearInterval(interval);
    }
  }, [message, isStreaming, words.length, disableAnimation]);

  // Handle text selection
  const handleMouseUp = () => {
    if (!onHighlight) return;
    
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 0 && messageRef.current?.contains(selection?.anchorNode || null)) {
      setSelectedText(text);
      setShowHighlightButton(true);
      
      // Get selection position for button placement
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if (rect) {
        setSelectionPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        });
      }
    } else {
      setShowHighlightButton(false);
    }
  };

  const handleHighlight = () => {
    if (selectedText && onHighlight) {
      onHighlight(selectedText);
      setShowHighlightButton(false);
      setSelectedText('');
      window.getSelection()?.removeAllRanges();
    }
  };

  // Handle click to toggle - but only if no text is selected
  const handleMessageClick = () => {
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().trim().length > 0;
    
    // Only toggle if there's no active selection
    if (!hasSelection && onToggle) {
      onToggle();
    }
  };

  // Close highlight button when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      if (showHighlightButton) {
        setShowHighlightButton(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showHighlightButton]);

  if (isCollapsed) {
    return (
      <div className="mb-2 animate-collapse">
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-2 opacity-40 hover:opacity-70 transition-opacity py-1 px-2 hover:bg-[#D4C4A8]/30 rounded cursor-pointer"
        >
          <div className="w-2 h-2 bg-[#9a8a6a] rounded-full flex-shrink-0" />
          <span style={{ fontSize: '0.75rem' }} className="truncate text-left min-w-0 flex-1">
            {sender === 'user' ? 'You: ' : ''}
            {message.length > 80 ? message.slice(0, 80) + '...' : message}
          </span>
          <span style={{ fontSize: '0.7rem' }} className="opacity-60 ml-auto flex-shrink-0 text-xs">
            {timestamp}
          </span>
        </button>
      </div>
    );
  }
  
  return (
    <div className="mb-4 sm:mb-6 w-full">
      <div className="flex items-start gap-2 sm:gap-3">
        {/* Avatar */}
        <div
          className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center border-2 border-[#9a8a6a] text-xs flex-shrink-0 ${ 
            sender === 'user' ? 'bg-[#E67E50]' : 'bg-[#F4D03F]'
          }`}
        >
          {sender === 'user' ? 'U' : 'A'}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1 sm:mb-2 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <span className="text-xs sm:text-sm opacity-60 truncate">{timestamp}</span>
              <span className="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 border border-[#9a8a6a] opacity-40 capitalize flex-shrink-0">
                {sender}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {onBookmark && (
                <button
                  onClick={onBookmark}
                  className={`p-1 sm:p-1.5 hover:bg-[#D4C4A8] border border-[#9a8a6a] transition-colors ${
                    isBookmarked ? 'bg-[#F4D03F]' : 'opacity-60 hover:opacity-100'
                  }`}
                  title={isBookmarked ? 'Remove bookmark' : 'Bookmark this message'}
                >
                  {isBookmarked ? (
                    <BookmarkCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  ) : (
                    <Bookmark className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  )}
                </button>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-1 sm:p-1.5 hover:bg-[#D4C4A8] border border-[#9a8a6a] transition-colors opacity-60 hover:opacity-100"
                  title="Edit message"
                >
                  <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Message Text */}
          <div
            ref={messageRef}
            onClick={handleMessageClick}
            onMouseUp={handleMouseUp}
            className={`border-2 border-[#9a8a6a] p-3 sm:p-4 bg-[#F5EFE3] transition-all relative text-sm sm:text-base ${
              isCollapsed ? 'cursor-pointer hover:bg-[#EDE5D8]' : ''
            } ${sender === 'assistant' && !isCollapsed ? 'cursor-pointer hover:bg-[#EDE5D8]' : ''}`}
            style={{
              userSelect: onHighlight ? 'text' : 'none',
            }}
          >
            {isCollapsed ? (
              <div className="opacity-60 text-sm truncate">{message}</div>
            ) : (
              <div className="whitespace-pre-wrap">
                {words.slice(0, displayedWords).map((word, index) => (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0 }}
                    className="inline-block mr-1"
                  >
                    {word}
                  </motion.span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Highlight Button */}
      {showHighlightButton && (
        <div
          style={{
            position: 'fixed',
            left: `${selectionPosition.x}px`,
            top: `${selectionPosition.y}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 1000,
          }}
        >
          <button
            onClick={handleHighlight}
            className="bg-[#F4D03F] border-2 border-[#9a8a6a] px-3 py-1.5 shadow-lg hover:bg-[#e4c02f] transition-colors flex items-center gap-2 text-sm"
          >
            <Highlighter className="w-3.5 h-3.5" />
            Highlight
          </button>
        </div>
      )}
    </div>
  );
}