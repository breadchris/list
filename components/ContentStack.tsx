import React, { useState, useEffect } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Content, contentRepository, Tag } from './ContentRepository';
import { LinkifiedText } from './LinkifiedText';
import { SEOCard } from './SEOCard';
import { JsContentDisplay } from './JsContentDisplay';
import { UrlPreviewCard } from './UrlPreviewCard';
import { YouTubeVideoCard } from './YouTubeVideoCard';
import { useToast } from './ToastProvider';
import { useInfiniteContentByParent, useInfiniteSearchContent, useDeleteContentMutation } from '../hooks/useContentQueries';
import { ContentSelectionState } from '../hooks/useContentSelection';
import { ContentInput } from './ContentInput';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SearchWorkflowSelector } from './SearchWorkflowSelector';
import { WorkflowAction } from './WorkflowFAB';

interface ContentStackProps {
  groupId: string;
  newContent?: Content;
  parentContentId?: string | null;
  onNavigate?: (parentId: string | null) => void;
  searchQuery: string;
  isSearching: boolean;
  selection: ContentSelectionState;
  showInput?: boolean;
  onInputClose?: () => void;
  onContentAdded?: (content: Content) => void;
  viewMode?: 'chronological' | 'random' | 'alphabetical' | 'oldest';
  contentType?: 'text' | 'ai-chat' | 'search';
  searchWorkflows?: WorkflowAction[];
  onSearchQueryChange?: (query: string) => void;
  activeExternalSearch?: string | null;
  onActivateExternalSearch?: (workflowId: string) => void;
  onExecuteExternalSearch?: () => void;
}

export const ContentStack: React.FC<ContentStackProps> = ({
  groupId,
  newContent,
  parentContentId = null,
  onNavigate,
  searchQuery,
  isSearching,
  selection,
  showInput = false,
  onInputClose,
  onContentAdded,
  viewMode = 'chronological',
  contentType = 'text',
  searchWorkflows = [],
  onSearchQueryChange,
  activeExternalSearch = null,
  onActivateExternalSearch = () => {},
  onExecuteExternalSearch = () => {}
}) => {
  const deleteContentMutation = useDeleteContentMutation();
  const toast = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Regular content query for non-search mode
  const {
    data: contentData,
    isLoading: contentLoading,
    hasNextPage: contentHasMore,
    fetchNextPage: fetchMoreContent,
  } = useInfiniteContentByParent(groupId, parentContentId, { enabled: !isSearching, viewMode });

  // Search query for search mode
  const {
    data: searchData,
    isLoading: searchLoading,
    hasNextPage: searchHasMore,
    fetchNextPage: fetchMoreSearch,
  } = useInfiniteSearchContent(groupId, searchQuery, parentContentId, { enabled: isSearching });

  // Get content items from the active query
  const allItems = isSearching
    ? searchData?.pages.flatMap(page => page.items) || []
    : contentData?.pages.flatMap(page => page.items) || [];

  const hasMore = isSearching ? searchHasMore : contentHasMore;
  const isLoading = isSearching ? searchLoading : contentLoading;

  // Reset index when content changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [groupId, parentContentId, isSearching, searchQuery]);

  // Add new content to the beginning
  useEffect(() => {
    if (newContent) {
      setCurrentIndex(0);
    }
  }, [newContent]);

  const currentItem = allItems[currentIndex];

  const handlePrevious = () => {
    if (currentIndex > 0 && !isAnimating) {
      setIsAnimating(true);
      setSwipeDirection('right');
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1);
        setSwipeDirection(null);
        setIsAnimating(false);
      }, 200);
    }
  };

  const handleNext = async () => {
    if (isAnimating) return;

    if (currentIndex < allItems.length - 1) {
      setIsAnimating(true);
      setSwipeDirection('left');
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setSwipeDirection(null);
        setIsAnimating(false);
      }, 200);
    } else if (hasMore) {
      setIsAnimating(true);
      // Fetch more content
      if (isSearching) {
        await fetchMoreSearch();
      } else {
        await fetchMoreContent();
      }
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setIsAnimating(false);
      }, 200);
    }
  };

  const handleDelete = async (contentId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this item?');
    if (!confirmed) return;

    try {
      await deleteContentMutation.mutateAsync(contentId);
      toast.success('Item deleted', 'Content item has been deleted.');

      // Adjust index after deletion
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Delete failed', 'Failed to delete content item.');
    }
  };

  // Swipe gesture handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      // Swipe left = next card
      handleNext();
    },
    onSwipedRight: () => {
      // Swipe right = previous card
      handlePrevious();
    },
    trackMouse: true, // Enable mouse swiping for desktop testing
    preventScrollOnSwipe: true,
  });

  const handleContentAdded = (content: Content) => {
    if (onContentAdded) {
      onContentAdded(content);
    }
    setCurrentIndex(0); // Show newly added content
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-gray-500">
          {isSearching ? (
            <>No results found for "{searchQuery}"</>
          ) : (
            <>No content yet. Click the + button to add some!</>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stack View */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-50">
        {currentItem ? (
          <>
            {/* Navigation Counter */}
            <div className="text-sm text-gray-500 mb-4">
              {currentIndex + 1} / {allItems.length}{hasMore && '+'}
            </div>

            {/* Card Container */}
            <div
              {...swipeHandlers}
              className={`w-full max-w-2xl bg-white rounded-lg shadow-lg p-6 relative transition-all duration-200 ${
                swipeDirection === 'left' ? 'translate-x-[-20px] opacity-70 scale-95' :
                swipeDirection === 'right' ? 'translate-x-[20px] opacity-70 scale-95' :
                'translate-x-0 opacity-100 scale-100'
              }`}
              style={{ touchAction: 'pan-y pinch-zoom' }}
            >
              {/* Selection Checkbox */}
              {selection.isSelectionMode && (
                <div className="absolute top-4 left-4 z-10">
                  <input
                    type="checkbox"
                    checked={selection.selectedItems.has(currentItem.id)}
                    onChange={() => selection.toggleItem(currentItem.id)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Content Display */}
              <div className="space-y-4">
                {currentItem.metadata?.seo && (
                  <SEOCard metadata={currentItem.metadata.seo} />
                )}

                {currentItem.metadata?.url_preview && !currentItem.metadata?.seo && (
                  <UrlPreviewCard
                    url={currentItem.data}
                    previewUrl={currentItem.metadata.url_preview}
                  />
                )}

                {currentItem.metadata?.youtube_video_id && (
                  <YouTubeVideoCard metadata={currentItem.metadata as any} />
                )}

                {['js', 'jsx', 'ts', 'tsx'].includes(currentItem.type) ? (
                  <JsContentDisplay content={currentItem} />
                ) : (
                  <div className="prose max-w-none">
                    <LinkifiedText text={currentItem.data} />
                  </div>
                )}

                {/* Tags */}
                {currentItem.tags && currentItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {currentItem.tags.map(tag => (
                      <span
                        key={tag.id}
                        className="inline-block px-3 py-1 text-sm rounded-full text-gray-700 bg-gray-100 border"
                        style={{
                          backgroundColor: tag.color ? `${tag.color}20` : undefined,
                          borderColor: tag.color || undefined
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-xs text-gray-500">
                    {new Date(currentItem.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex space-x-2">
                    {currentItem.has_children && onNavigate && (
                      <button
                        onClick={() => onNavigate(currentItem.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm px-3 py-1 rounded-md hover:bg-blue-50"
                      >
                        Open
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(currentItem.id)}
                      className="text-red-600 hover:text-red-800 text-sm px-3 py-1 rounded-md hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex space-x-4 mt-6">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className={`p-3 rounded-full ${
                  currentIndex === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                } transition-colors`}
                title="Previous"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex >= allItems.length - 1 && !hasMore}
                className={`p-3 rounded-full ${
                  currentIndex >= allItems.length - 1 && !hasMore
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                } transition-colors`}
                title="Next"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </>
        ) : (
          <div className="text-gray-500">No more items to display</div>
        )}
      </div>
    </div>
  );
};
