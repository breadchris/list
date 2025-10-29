import React, { useEffect, useRef, useState, useMemo } from 'react';
import Masonry from 'react-masonry-css';
import { Content, contentRepository, Tag, TagFilter, SEOMetadata, SharingMetadata, YouTubeVideoMetadata } from './ContentRepository';
import { LinkifiedText } from './LinkifiedText';
import { SEOCard } from './SEOCard';
import { JsContentDisplay } from './JsContentDisplay';
import { UrlPreviewCard } from './UrlPreviewCard';
import { YouTubeVideoCard } from './YouTubeVideoCard';
import { YouTubeSectionCard } from './YouTubeSectionCard';
import { ImageDisplay } from './ImageDisplay';
import { AudioDisplay } from './AudioDisplay';
import { EpubViewer } from './EpubViewer';
import { TranscriptViewer } from './TranscriptViewer';
import { TsxRenderer } from './TsxRenderer';
import { PluginRenderer } from './PluginRenderer';
import { useToast } from './ToastProvider';
import { useInfiniteContentByParent, useInfiniteSearchContent, useInfiniteContentByTag, useDeleteContentMutation, useContentById } from '../hooks/useContentQueries';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from '../hooks/queryKeys';
import { ContentSelectionState } from '../hooks/useContentSelection';
import { ContentListSkeleton } from './SkeletonComponents';
import { TagButton } from './TagButton';
import { TruncatedContent } from './TruncatedContent';
import { ContentJobsIndicator } from './ContentJobsIndicator';
import { useActiveJobs } from '../hooks/useJobsQueries';
import { supabase } from './SupabaseClient';
import { QueryInvalidation } from '../hooks/queryKeys';
import { PieMenu } from './pie/PieMenu';
import { useContentPieMenu } from '../hooks/useContentPieMenu';

interface ContentMasonryProps {
  groupId: string;
  userId?: string;
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
  searchWorkflows?: any[];
  onSearchQueryChange?: (query: string) => void;
  activeExternalSearch?: string | null;
  onActivateExternalSearch?: (workflowId: string) => void;
  onExecuteExternalSearch?: () => void;
  selectedTagFilter?: TagFilter[];
}

interface TagDisplayProps {
  tags: Tag[];
  isVisible: boolean;
}

const TagDisplay: React.FC<TagDisplayProps> = ({ tags, isVisible }) => {
  if (!tags || tags.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 items-center transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      {tags.map(tag => (
        <span
          key={tag.id}
          className="inline-block px-2 py-0.5 text-xs rounded-full text-gray-600 bg-gray-100 border"
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

export const ContentMasonry: React.FC<ContentMasonryProps> = ({
  groupId,
  userId,
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
  onExecuteExternalSearch = () => {},
  selectedTagFilter = []
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const deleteContentMutation = useDeleteContentMutation();
  const toast = useToast();

  // Skeleton delay state to prevent flashing
  const [showSkeleton, setShowSkeleton] = useState(false);

  // Content persistence state to prevent immediate clearing during navigation
  const [persistentItems, setPersistentItems] = useState<Content[]>([]);

  // Hover state for tag button visibility
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  // Pie menu for tag application
  const {
    isPieMenuOpen,
    pieMenuPosition,
    pieMenuItems,
    handleContextMenu,
    closePieMenu
  } = useContentPieMenu(groupId);

  // Split tag filters into include and exclude arrays
  const includeTagIds = useMemo(() =>
    selectedTagFilter.filter(tf => tf.mode === 'include').map(tf => tf.tag.id),
    [selectedTagFilter]
  );
  const excludeTagIds = useMemo(() =>
    selectedTagFilter.filter(tf => tf.mode === 'exclude').map(tf => tf.tag.id),
    [selectedTagFilter]
  );

  // Determine which query to use based on search state and tag filter
  const isTagFilterActive = selectedTagFilter.length > 0 && !isSearching;

  // Regular content query for non-search mode (when no tag filter is active)
  const {
    data: contentData,
    isLoading: contentLoading,
    isFetching: contentFetching,
    isFetchingNextPage: contentFetchingNext,
    hasNextPage: contentHasMore,
    fetchNextPage: fetchMoreContent,
    error: contentError,
    status: contentStatus
  } = useInfiniteContentByParent(groupId, parentContentId, { enabled: !isSearching && !isTagFilterActive, viewMode });

  // Tag-filtered query (when tag filter is active and not searching)
  const {
    data: tagData,
    isLoading: tagLoading,
    isFetching: tagFetching,
    isFetchingNextPage: tagFetchingNext,
    hasNextPage: tagHasMore,
    fetchNextPage: fetchMoreTag,
    error: tagError,
    status: tagStatus
  } = useInfiniteContentByTag(groupId, parentContentId, includeTagIds, excludeTagIds, { enabled: isTagFilterActive, viewMode });

  // Search query for search mode
  const {
    data: searchData,
    isLoading: searchLoading,
    isFetching: searchFetching,
    isFetchingNextPage: searchFetchingNext,
    hasNextPage: searchHasMore,
    fetchNextPage: fetchMoreSearch,
    error: searchError,
    status: searchStatus
  } = useInfiniteSearchContent(groupId, searchQuery, parentContentId, { enabled: isSearching, viewMode });

  // Query for parent content when viewing children
  const {
    data: parentContent,
    isLoading: parentLoading
  } = useContentById(
    parentContentId || '',
    { enabled: !!parentContentId && !isSearching }
  );

  // Fetch all active jobs for the group (optimized single query)
  const { jobsByContentId } = useActiveJobs(groupId);

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

  // Set up real-time subscription for content_tags changes
  useEffect(() => {
    if (!groupId) return;

    const tagsSubscription = contentRepository.subscribeToContentTags(
      groupId,
      (payload) => {
        // When tags change, invalidate content queries to refetch with updated tags
        queryClient.invalidateQueries({ queryKey: QueryKeys.contentByParent(groupId, parentContentId) });
        queryClient.invalidateQueries({ queryKey: QueryKeys.contentSearch(groupId) });
      }
    );

    return () => {
      tagsSubscription.unsubscribe();
    };
  }, [groupId, parentContentId, queryClient]);

  // Set up real-time subscription for job status changes
  useEffect(() => {
    if (!userId) return;

    const jobsSubscription = contentRepository.subscribeToJobs(userId, (payload) => {
      // When job status changes, invalidate jobs query to refetch
      queryClient.invalidateQueries({ queryKey: QueryKeys.activeJobsByGroup(groupId) });
    });

    return () => {
      jobsSubscription.unsubscribe();
    };
  }, [userId, groupId, queryClient]);

  // Realtime subscription for DELETE events
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`content-deletes-masonry-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'content',
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          console.log('Content deleted via realtime (masonry):', payload);
          const deletedId = payload.old.id;

          // Remove from individual content cache
          queryClient.removeQueries({ queryKey: QueryKeys.contentById(deletedId) });

          // Invalidate all content lists to remove from UI
          queryClient.invalidateQueries({
            queryKey: QueryInvalidation.allContentForGroup(groupId)
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);

  // Realtime subscription for content relationship changes
  useEffect(() => {
    if (!parentContentId) return;

    const channel = supabase
      .channel(`relationships-masonry-${parentContentId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'content_relationships',
          filter: `from_content_id=eq.${parentContentId}`
        },
        (payload) => {
          console.log('Relationship changed via realtime (masonry):', payload);

          // Invalidate content lists to refresh with new relationships
          queryClient.invalidateQueries({
            queryKey: QueryInvalidation.allContentForGroup(groupId)
          });

          // Also invalidate parent queries for the affected content
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            const affectedContentId = payload.new?.to_content_id || payload.old?.to_content_id;
            if (affectedContentId) {
              queryClient.invalidateQueries({
                queryKey: QueryKeys.parentsByContent(affectedContentId)
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [parentContentId, groupId, queryClient]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    // Load more when scrolled to bottom (but not if already fetching next page)
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (isSearching && searchHasMore && !searchFetchingNext && !searchFetching) {
        fetchMoreSearch();
      } else if (isTagFilterActive && tagHasMore && !tagFetchingNext && !tagFetching) {
        fetchMoreTag();
      } else if (!isSearching && !isTagFilterActive && contentHasMore && !contentFetchingNext && !contentFetching) {
        fetchMoreContent();
      }
    }
  };

  const handleDelete = async (contentId: string) => {
    // Simple confirmation using window.confirm for now - could be enhanced with modal later
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      await deleteContentMutation.mutateAsync(contentId);
      toast.success('Item deleted successfully');
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete item', 'Please try again.');
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

  // Format timestamp in MM:SS or HH:MM:SS format
  const formatTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isContentPublic = (content: Content): boolean => {
    const sharingData = content.metadata?.sharing as SharingMetadata;
    return sharingData?.isPublic || false;
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
  const tagItems = tagData?.pages.flatMap(page => page.items) ?? [];
  const searchItems = searchData?.pages.flatMap(page => page.items) ?? [];

  // Determine which data to use based on active mode
  const currentItems = isSearching ? searchItems : (isTagFilterActive ? tagItems : contentItems);
  const currentLoading = isSearching ? searchLoading : (isTagFilterActive ? tagLoading : contentLoading);
  // Use persistent items during loading to avoid clearing content immediately
  const displayItems = currentLoading && persistentItems.length > 0 ? persistentItems : currentItems;
  const currentFetching = isSearching ? searchFetching : (isTagFilterActive ? tagFetching : contentFetching);
  const currentFetchingNext = isSearching ? searchFetchingNext : (isTagFilterActive ? tagFetchingNext : contentFetchingNext);
  const currentHasMore = isSearching ? searchHasMore : (isTagFilterActive ? tagHasMore : contentHasMore);
  const currentError = isSearching ? searchError : (isTagFilterActive ? tagError : contentError);
  const currentStatus = isSearching ? searchStatus : (isTagFilterActive ? tagStatus : contentStatus);

  // Masonry breakpoints configuration - Pinterest-style responsive columns
  const breakpointColumnsObj = {
    default: 5,   // 5 columns on very large screens (> 1536px)
    1536: 4,      // 4 columns on large screens (1024-1536px)
    1024: 3,      // 3 columns on tablets (640-1024px)
    640: 2        // 2 columns on mobile (< 640px)
  };

  // Render individual content item (same logic as ContentList)
  const renderContentItem = (item: Content) => {
    const isSelected = selection.selectedItems.has(item.id);

    return (
      <div
        key={item.id}
        className={`bg-white rounded-lg shadow-sm border p-3 sm:p-4 hover:shadow-md transition-all cursor-pointer relative break-inside-avoid mb-4 ${
          isSelected
            ? 'border-blue-500 border-2 bg-blue-50'
            : 'border-gray-200'
        }`}
        onClick={() => handleContentClick(item)}
        onMouseEnter={() => setHoveredItemId(item.id)}
        onMouseLeave={() => setHoveredItemId(null)}
        onContextMenu={(e) => {
          if (!selection.isSelectionMode) {
            handleContextMenu(e, item);
          }
        }}
      >
        {/* Selection indicator */}
        {selection.isSelectionMode && (
          <div className="absolute top-3 right-3 z-10">
            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center touch-manipulation ${
              isSelected
                ? 'bg-blue-500 border-blue-500'
                : 'border-gray-300 bg-white'
            }`}>
              {isSelected && (
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2">
          {/* Main content area */}
          <div className={`flex-1 min-w-0 ${selection.isSelectionMode ? 'pr-8 sm:pr-10' : ''}`}>
            {item.type === 'seo' ? (
              <div>
                <SEOCard
                  metadata={item.metadata as SEOMetadata}
                  onClick={() => handleContentClick(item)}
                />
                <TagDisplay tags={item.tags || []} isVisible={true} />
                <ContentJobsIndicator jobs={jobsByContentId.get(item.id) || []} className="mt-2" />
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-xs text-gray-500">
                    {formatRelativeTime(item.created_at)}
                  </p>
                  {item.child_count && item.child_count > 0 && (
                    <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ) : item.type === 'js' ? (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <span className="text-xs font-medium text-green-600 uppercase tracking-wide">JavaScript</span>
                </div>
                <JsContentDisplay code={item.data} maxLines={8} />
                <TagDisplay tags={item.tags || []} isVisible={true} />
                <ContentJobsIndicator jobs={jobsByContentId.get(item.id) || []} className="mt-2" />
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-xs text-gray-500">
                    {formatRelativeTime(item.created_at)}
                  </p>
                  {item.child_count && item.child_count > 0 && (
                    <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ) : item.type === 'image' ? (
              <div>
                <ImageDisplay imageUrl={item.data} alt="Uploaded image" />
                <TagDisplay tags={item.tags || []} isVisible={true} />
                <ContentJobsIndicator jobs={jobsByContentId.get(item.id) || []} className="mt-2" />
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-xs text-gray-500">
                    {formatRelativeTime(item.created_at)}
                  </p>
                  {item.child_count && item.child_count > 0 && (
                    <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ) : item.type === 'video_section' ? (
              <div>
                {/* YouTube Video Section Card */}
                <YouTubeSectionCard
                  contentId={item.id}
                  youtubeUrl={item.metadata?.youtube_url || ''}
                  startTime={item.metadata?.start_time || 0}
                  endTime={item.metadata?.end_time || 0}
                  title={item.data}
                  metadata={item.metadata}
                  onClick={() => handleContentClick(item)}
                />
                <TagDisplay tags={item.tags || []} isVisible={true} />
                <ContentJobsIndicator jobs={jobsByContentId.get(item.id) || []} className="mt-2" />
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-xs text-gray-500">
                    {formatRelativeTime(item.created_at)}
                  </p>
                  {item.child_count && item.child_count > 0 && (
                    <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ) : item.metadata?.youtube_video_id || item.metadata?.extracted_from_playlist ? (
              <div>
                {/* YouTube Video Card */}
                <YouTubeVideoCard
                  metadata={item.metadata as YouTubeVideoMetadata}
                  videoUrl={(item.metadata as YouTubeVideoMetadata).youtube_url || `https://youtube.com/watch?v=${item.metadata.youtube_video_id}`}
                  onClick={() => handleContentClick(item)}
                />
                <TagDisplay tags={item.tags || []} isVisible={true} />
                <ContentJobsIndicator jobs={jobsByContentId.get(item.id) || []} className="mt-2" />
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-xs text-gray-500">
                    {formatRelativeTime(item.created_at)}
                  </p>
                  {item.child_count && item.child_count > 0 && (
                    <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <LinkifiedText
                  text={item.data}
                  className="text-gray-900 whitespace-pre-wrap break-words text-sm sm:text-base"
                  maxHeight={200}
                />
                {/* URL Preview Image */}
                {item.metadata?.url_preview && (
                  <UrlPreviewCard previewUrl={item.metadata.url_preview} />
                )}
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-xs text-gray-500">
                    {formatRelativeTime(item.created_at)}
                  </p>
                  {item.child_count && item.child_count > 0 ? (
                    <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested ${item.child_count === 1 ? 'item' : 'items'}`}>
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>{item.child_count}</span>
                    </div>
                  ) : null}
                  <TagDisplay tags={item.tags || []} isVisible={true} />
                </div>
                <ContentJobsIndicator jobs={jobsByContentId.get(item.id) || []} className="mt-2" />
              </div>
            )}
          </div>

          {/* Right gutter for icons and actions */}
          {!selection.isSelectionMode && (
            <div className="flex flex-col items-center gap-1 w-8">
              {/* Public globe icon */}
              {isContentPublic(item) && (
                <div className="flex-shrink-0" title="This content is public">
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}

              {/* Selection button */}
              {hoveredItemId === item.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!selection.isSelectionMode) {
                      selection.toggleSelectionMode();
                    }
                    selection.toggleItem(item.id);
                  }}
                  className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Select for workflow"
                >
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}

              {/* Tag button */}
              <TagButton
                contentId={item.id}
                existingTags={item.tags || []}
                isVisible={hoveredItemId === item.id}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Content Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {displayItems.length === 0 && !currentLoading && currentStatus === 'success' ? (
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
          <div className="p-3 sm:p-4">
            {/* Masonry Grid */}
            <Masonry
              breakpointCols={breakpointColumnsObj}
              className="flex -ml-4 w-auto"
              columnClassName="pl-4 bg-clip-padding"
            >
              {displayItems.map(renderContentItem)}
            </Masonry>

            {/* Background refresh indicator */}
            {currentFetching && !currentLoading && !currentFetchingNext && displayItems.length > 0 && (
              <div className="flex justify-center py-2">
                <div className="flex items-center text-xs text-gray-500">
                  <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full mr-2"></div>
                  Refreshing...
                </div>
              </div>
            )}

            {/* Load More Button */}
            {currentHasMore && currentItems.length > 0 && (
              <div className="flex justify-center py-4">
                {currentFetchingNext ? (
                  <div className="flex items-center px-4 py-2 text-blue-600">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                    Loading more...
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (isSearching) {
                        fetchMoreSearch();
                      } else if (isTagFilterActive) {
                        fetchMoreTag();
                      } else {
                        fetchMoreContent();
                      }
                    }}
                    className="px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={currentFetching}
                  >
                    {isSearching ? 'Load More Results' : 'Load More'}
                  </button>
                )}
              </div>
            )}

            {/* Error State */}
            {currentError && (
              <div className="flex justify-center py-4">
                <div className="text-center">
                  <div className="text-red-600 text-sm mb-2">
                    {currentError.message?.includes('JWT') || currentError.message?.includes('auth')
                      ? 'Authentication refreshing... please wait'
                      : 'Error loading content. Please try again.'
                    }
                  </div>
                  {!currentError.message?.includes('JWT') && !currentError.message?.includes('auth') && (
                    <button
                      onClick={() => {
                        if (isSearching) {
                          queryClient.resetQueries({ queryKey: QueryKeys.contentSearch(groupId, searchQuery, parentContentId) });
                        } else {
                          queryClient.resetQueries({ queryKey: QueryKeys.contentByParent(groupId, parentContentId) });
                        }
                      }}
                      className="px-3 py-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-300 rounded transition-colors"
                    >
                      Retry
                    </button>
                  )}
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

      {/* Pie menu for tag application (only when not in selection mode) */}
      {!selection.isSelectionMode && (
        <PieMenu
          items={pieMenuItems}
          isOpen={isPieMenuOpen}
          position={pieMenuPosition}
          onClose={closePieMenu}
        />
      )}
    </div>
  );
};
