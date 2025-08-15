import React, { useState, useEffect, useRef } from 'react';
import { Content, contentRepository } from '../data/ContentRepository';

interface ContentListProps {
  groupId: string;
  newContent?: Content;
}

export const ContentList: React.FC<ContentListProps> = ({ groupId, newContent }) => {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial content when group changes
  useEffect(() => {
    if (groupId) {
      loadContent(true);
    }
  }, [groupId]);

  // Add new content to the list
  useEffect(() => {
    if (newContent && newContent.group_id === groupId) {
      setContent(prev => [newContent, ...prev]);
    }
  }, [newContent, groupId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!groupId) return;

    const subscription = contentRepository.subscribeToGroupContent(
      groupId,
      (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        switch (eventType) {
          case 'INSERT':
            // Only add if it's not the newContent we already added
            if (newRecord && newRecord.id !== newContent?.id) {
              setContent(prev => [newRecord, ...prev]);
            }
            break;
          case 'UPDATE':
            if (newRecord) {
              setContent(prev => 
                prev.map(item => 
                  item.id === newRecord.id ? newRecord : item
                )
              );
            }
            break;
          case 'DELETE':
            if (oldRecord) {
              setContent(prev => 
                prev.filter(item => item.id !== oldRecord.id)
              );
            }
            break;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [groupId, newContent]);

  const loadContent = async (reset = false) => {
    if (loading) return;

    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const items = await contentRepository.getContentByGroup(groupId, newOffset, 20);
      
      if (reset) {
        setContent(items);
        setOffset(items.length);
      } else {
        setContent(prev => [...prev, ...items]);
        setOffset(prev => prev + items.length);
      }
      
      setHasMore(items.length === 20);
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // Load more when scrolled to bottom
    if (scrollHeight - scrollTop <= clientHeight + 100 && hasMore && !loading) {
      loadContent();
    }
  };

  const handleDelete = async (contentId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      await contentRepository.deleteContent(contentId);
      // The real-time subscription will handle removing it from the list
    } catch (error) {
      console.error('Error deleting content:', error);
      alert('Failed to delete item');
    }
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days}d ago`;
      return date.toLocaleDateString();
    }
  };

  if (!groupId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg">No group selected</p>
          <p className="text-sm">Create or join a group to start adding content</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto bg-gray-50"
      onScroll={handleScroll}
    >
      {content.length === 0 && !loading ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <p className="text-lg">No items yet</p>
            <p className="text-sm">Add your first item below</p>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {content.map((item) => (
            <div 
              key={item.id} 
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 whitespace-pre-wrap break-words">
                    {item.data}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {formatRelativeTime(item.created_at)}
                  </p>
                </div>
                
                <button
                  onClick={() => handleDelete(item.id)}
                  className="ml-3 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete item"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-center py-4">
              <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}
          
          {!hasMore && content.length > 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No more items
            </div>
          )}
        </div>
      )}
    </div>
  );
};