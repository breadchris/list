import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Content, contentRepository, Tag } from './ContentRepository';
import { LinkifiedText } from './LinkifiedText';

interface ContentListProps {
  groupId: string;
  newContent?: Content;
  parentContentId?: string | null;
  onNavigate?: (parentId: string | null) => void;
  searchQuery: string;
  searchResults: Content[];
  searchLoading: boolean;
  searchHasMore: boolean;
  isSearching: boolean;
  onLoadMoreSearchResults: () => void;
}

interface TagDisplayProps {
  tags: Tag[];
}

const TagDisplay: React.FC<TagDisplayProps> = ({ tags }) => {
  if (!tags || tags.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {tags.map(tag => (
        <span
          key={tag.id}
          className="inline-block px-2 py-1 text-xs rounded-full text-gray-600 bg-gray-100 border"
          style={{
            backgroundColor: tag.color ? `${tag.color}20` : undefined,
            borderColor: tag.color || undefined
          }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
};

export const ContentList: React.FC<ContentListProps> = ({ 
  groupId, 
  newContent, 
  parentContentId = null, 
  onNavigate,
  searchQuery,
  searchResults,
  searchLoading,
  searchHasMore,
  isSearching,
  onLoadMoreSearchResults
}) => {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial content when group or parent changes
  useEffect(() => {
    if (groupId) {
      loadContent(true);
    }
  }, [groupId, parentContentId]);

  // Add new content to the list
  useEffect(() => {
    if (newContent && newContent.group_id === groupId && newContent.parent_content_id === parentContentId) {
      if (!isSearching) {
        setContent(prev => [newContent, ...prev]);
      }
    }
  }, [newContent, groupId, parentContentId, isSearching]);

  // Set up real-time subscription
  useEffect(() => {
    if (!groupId) return;

    const subscription = contentRepository.subscribeToGroupContent(
      groupId,
      (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        switch (eventType) {
          case 'INSERT':
            // Only add if it's not the newContent we already added and matches current context
            if (newRecord && newRecord.id !== newContent?.id && newRecord.parent_content_id === parentContentId && !isSearching) {
              setContent(prev => [newRecord, ...prev]);
            }
            break;
          case 'UPDATE':
            if (newRecord && !isSearching) {
              setContent(prev => 
                prev.map(item => 
                  item.id === newRecord.id ? newRecord : item
                )
              );
            }
            break;
          case 'DELETE':
            if (oldRecord && !isSearching) {
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
  }, [groupId, newContent, parentContentId, isSearching]);

  const loadContent = async (reset = false) => {
    if (loading) return;

    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const items = await contentRepository.getContentByParent(groupId, parentContentId, newOffset, 20);
      
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
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (isSearching && searchHasMore && !searchLoading) {
        onLoadMoreSearchResults();
      } else if (!isSearching && hasMore && !loading) {
        loadContent();
      }
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

  // Navigate to child content
  const handleContentClick = (contentItem: Content) => {
    if (onNavigate) {
      onNavigate(contentItem.id);
    }
  };

  // Navigate back to parent
  const handleBackClick = () => {
    if (onNavigate) {
      // Find parent of current parent to navigate back
      onNavigate(null); // Simplified - goes back to root
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

  const currentItems = isSearching ? searchResults : content;
  const currentLoading = isSearching ? searchLoading : loading;
  const currentHasMore = isSearching ? searchHasMore : hasMore;

  return (
    <div className="flex-1 flex flex-col bg-gray-50">

      {/* Content Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {currentItems.length === 0 && !currentLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              {isSearching ? (
                <>
                  <p className="text-lg">No results found</p>
                  <p className="text-sm">Try different search terms</p>
                </>
              ) : (
                <>
                  <p className="text-lg">No items yet</p>
                  <p className="text-sm">Add your first item below</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {currentItems.map((item) => (
              <div 
                key={item.id} 
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleContentClick(item)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <LinkifiedText
                      text={item.data}
                      className="text-gray-900 whitespace-pre-wrap break-words"
                    />
                    <TagDisplay tags={item.tags || []} />
                    <p className="text-xs text-gray-500 mt-2">
                      {formatRelativeTime(item.created_at)}
                    </p>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
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
            
            {currentLoading && (
              <div className="flex justify-center py-4">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            )}
            
            {/* Load More Button for Normal Content */}
            {!isSearching && hasMore && !loading && content.length > 0 && (
              <div className="flex justify-center py-4">
                <button
                  onClick={() => loadContent()}
                  className="px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Load More
                </button>
              </div>
            )}
            
            {/* Load More Button for Search Results */}
            {isSearching && searchHasMore && !searchLoading && searchResults.length > 0 && (
              <div className="flex justify-center py-4">
                <button
                  onClick={onLoadMoreSearchResults}
                  className="px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Load More Results
                </button>
              </div>
            )}
            
            {!currentHasMore && currentItems.length > 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                {isSearching ? 'No more search results' : 'No more items'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};