import { useState, useRef } from 'react';
import { Bookmark, X, GripVertical } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';

export interface BookmarkedMessage {
  id: string;
  messageId: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  order: number;
}

interface BookmarksSidebarProps {
  bookmarks: BookmarkedMessage[];
  onReorderBookmarks: (reordered: BookmarkedMessage[]) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
  onClickBookmark: (messageId: string) => void;
}

export function BookmarksSidebar({ 
  bookmarks, 
  onReorderBookmarks, 
  onRemoveBookmark,
  onClickBookmark 
}: BookmarksSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Truncate text for preview
  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className="w-80 bg-[#E8DCC8] border-l-2 border-[#9a8a6a] flex flex-col h-screen">
      {/* Header */}
      <div className="bg-[#F4D03F] border-b-2 border-[#9a8a6a] p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Bookmark className="w-5 h-5" />
          <h2 className="text-sm">Bookmarks</h2>
        </div>
        <div className="text-xs opacity-60">
          {bookmarks.length} saved
        </div>
      </div>

      {/* Bookmarks List */}
      <div className="flex-1 overflow-y-auto p-4">
        {bookmarks.length === 0 ? (
          <div className="text-center py-12 px-4 opacity-60">
            <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No bookmarks yet</p>
            <p className="text-xs mt-2">
              Click the bookmark icon on any message to save it here
            </p>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={bookmarks}
            onReorder={onReorderBookmarks}
            className="space-y-3"
          >
            <AnimatePresence>
              {bookmarks.map((bookmark) => (
                <Reorder.Item
                  key={bookmark.id}
                  value={bookmark}
                  whileHover={{ scale: 1.02 }}
                  whileDrag={{ 
                    scale: 1.05,
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
                    zIndex: 10,
                  }}
                  onMouseEnter={() => setHoveredId(bookmark.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="cursor-pointer"
                  layout
                >
                  <motion.div
                    className={`bg-[#F5EFE3] border-2 border-[#9a8a6a] p-3 transition-colors ${
                      hoveredId === bookmark.id ? 'bg-[#EDE5D8]' : ''
                    }`}
                    onClick={() => onClickBookmark(bookmark.messageId)}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ 
                      opacity: 0, 
                      x: -100,
                      transition: { duration: 0.2 }
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        <GripVertical className="w-4 h-4 opacity-40 flex-shrink-0" />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            className={`text-xs px-2 py-0.5 border border-[#9a8a6a] ${
                              bookmark.sender === 'user'
                                ? 'bg-[#E67E50]'
                                : 'bg-[#D4C4A8]'
                            }`}
                          >
                            {bookmark.sender === 'user' ? 'You' : 'AI'}
                          </span>
                          <span className="text-xs opacity-60 truncate">
                            {bookmark.timestamp}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveBookmark(bookmark.id);
                        }}
                        className="p-1 hover:bg-[#D4C4A8] border border-[#9a8a6a] transition-colors flex-shrink-0"
                        title="Remove bookmark"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Preview Text */}
                    <p className="text-sm leading-relaxed">
                      {truncateText(bookmark.text)}
                    </p>
                  </motion.div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>

      {/* Footer */}
      <div className="border-t-2 border-[#9a8a6a] p-3 bg-[#E8DCC8] flex-shrink-0">
        <p className="text-xs opacity-60 text-center">
          Drag to reorder • Click to jump to message
        </p>
      </div>
    </div>
  );
}
