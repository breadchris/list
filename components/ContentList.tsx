import React, { useEffect, useRef } from 'react';
import { Content, contentRepository, Tag } from './ContentRepository';
import { LinkifiedText } from './LinkifiedText';
import { useInfiniteContentByParent, useInfiniteSearchContent, useDeleteContentMutation } from '../hooks/useContentQueries';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from '../hooks/queryKeys';
import { ContentSelectionState } from '../hooks/useContentSelection';

interface ContentListProps {
  groupId: string;
  newContent?: Content;
  parentContentId?: string | null;
  onNavigate?: (parentId: string | null) => void;
  searchQuery: string;
  isSearching: boolean;
  selection: ContentSelectionState;
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
  isSearching,
  selection
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const deleteContentMutation = useDeleteContentMutation();

  // Regular content query for non-search mode
  const {
    data: contentData,
    isLoading: contentLoading,
    isFetching: contentFetching,
    hasNextPage: contentHasMore,
    fetchNextPage: fetchMoreContent,
    error: contentError
  } = useInfiniteContentByParent(groupId, parentContentId, { enabled: !isSearching });

  // Search query for search mode
  const {
    data: searchData,
    isLoading: searchLoading,
    isFetching: searchFetching,
    hasNextPage: searchHasMore,
    fetchNextPage: fetchMoreSearch,
    error: searchError
  } = useInfiniteSearchContent(groupId, searchQuery, parentContentId, { enabled: isSearching });

  // Handle optimistic updates for new content
  useEffect(() => {
    if (newContent && newContent.group_id === groupId && newContent.parent_content_id === parentContentId) {
      // Add to React Query cache optimistically
      const queryKey = QueryKeys.contentByParent(groupId, parentContentId);
      queryClient.setQueryData(queryKey, (old: any) => {
        if (old?.pages) {
          return {
            ...old,
            pages: old.pages.map((page: any, index: number) => 
              index === 0 
                ? { ...page, items: [newContent, ...page.items] }
                : page
            ),
          };
        }
        return old;
      });
    }
  }, [newContent, groupId, parentContentId, queryClient]);

  // Set up real-time subscription to update React Query cache
  useEffect(() => {
    if (!groupId) return;

    const subscription = contentRepository.subscribeToGroupContent(
      groupId,
      (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        const queryKey = QueryKeys.contentByParent(groupId, parentContentId);
        
        switch (eventType) {
          case 'INSERT':
            // Only add if it's not the newContent we already added and matches current context
            if (newRecord && newRecord.id !== newContent?.id && newRecord.parent_content_id === parentContentId) {
              queryClient.setQueryData(queryKey, (old: any) => {
                if (old?.pages) {
                  return {
                    ...old,
                    pages: old.pages.map((page: any, index: number) => 
                      index === 0 
                        ? { ...page, items: [newRecord, ...page.items] }
                        : page
                    ),
                  };
                }
                return old;
              });
            }
            break;
          case 'UPDATE':
            if (newRecord) {
              queryClient.setQueryData(queryKey, (old: any) => {
                if (old?.pages) {
                  return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                      ...page,
                      items: page.items.map((item: Content) => 
                        item.id === newRecord.id ? newRecord : item
                      )
                    })),
                  };
                }
                return old;
              });
            }
            break;
          case 'DELETE':
            if (oldRecord) {
              queryClient.setQueryData(queryKey, (old: any) => {
                if (old?.pages) {
                  return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                      ...page,
                      items: page.items.filter((item: Content) => item.id !== oldRecord.id)
                    })),
                  };
                }
                return old;
              });
            }
            break;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [groupId, newContent, parentContentId, queryClient]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // Load more when scrolled to bottom
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (isSearching && searchHasMore && !searchFetching) {
        fetchMoreSearch();
      } else if (!isSearching && contentHasMore && !contentFetching) {
        fetchMoreContent();
      }
    }
  };

  const handleDelete = async (contentId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      await deleteContentMutation.mutateAsync(contentId);
    } catch (error) {
      console.error('Error deleting content:', error);
      alert('Failed to delete item');
    }
  };

  // Handle content click - either navigate or toggle selection
  const handleContentClick = (contentItem: Content) => {
    if (selection.isSelectionMode) {
      // In selection mode, toggle item selection
      selection.toggleItem(contentItem.id);
    } else {
      // Normal mode, navigate to content
      if (onNavigate) {
        onNavigate(contentItem.id);
      }
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

  // Flatten the paginated data
  const contentItems = contentData?.pages.flatMap(page => page.items) ?? [];
  const searchItems = searchData?.pages.flatMap(page => page.items) ?? [];
  
  const currentItems = isSearching ? searchItems : contentItems;
  const currentLoading = isSearching ? searchLoading : contentLoading;
  const currentFetching = isSearching ? searchFetching : contentFetching;
  const currentHasMore = isSearching ? searchHasMore : contentHasMore;
  const currentError = isSearching ? searchError : contentError;

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
            {currentItems.map((item) => {
              const isSelected = selection.selectedItems.has(item.id);
              return (
                <div 
                  key={item.id} 
                  className={`bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-all cursor-pointer relative ${
                    isSelected 
                      ? 'border-blue-500 border-2 bg-blue-50' 
                      : 'border-gray-200'
                  }`}
                  onClick={() => handleContentClick(item)}
                >
                  {/* Selection indicator */}
                  {selection.isSelectionMode && (
                    <div className="absolute top-2 right-2 z-10">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected 
                          ? 'bg-blue-500 border-blue-500' 
                          : 'border-gray-300 bg-white'
                      }`}>
                        {isSelected && (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}
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
              );
            })}
            
            {(currentLoading || currentFetching) && (
              <div className="flex justify-center py-4">
                <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            )}
            
            {/* Load More Button */}
            {currentHasMore && !currentFetching && currentItems.length > 0 && (
              <div className="flex justify-center py-4">
                <button
                  onClick={() => isSearching ? fetchMoreSearch() : fetchMoreContent()}
                  className="px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                  disabled={currentFetching}
                >
                  {isSearching ? 'Load More Results' : 'Load More'}
                </button>
              </div>
            )}
            
            {/* Error State */}
            {currentError && (
              <div className="flex justify-center py-4">
                <div className="text-red-600 text-sm">
                  Error loading content. Please try again.
                </div>
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