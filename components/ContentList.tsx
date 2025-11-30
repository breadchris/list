import React, { useEffect, useRef, useState, useMemo } from 'react';
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
import { ContentInput } from './ContentInput';
import { TagButton } from './TagButton';
import { VoteButtons } from './VoteButtons';
import { TruncatedContent } from './TruncatedContent';
import { SearchWorkflowSelector } from './SearchWorkflowSelector';
import { WorkflowAction } from './WorkflowFAB';
import { ContentJobsIndicator } from './ContentJobsIndicator';
import { useActiveJobs } from '../hooks/useJobsQueries';
import { useBatchUserVotes, useBatchContentVotes, calculateVoteScoresFromBatch } from '../hooks/useContentVotes';
import { UserAvatar } from './UserAvatar';
import { supabase } from './SupabaseClient';
import { QueryInvalidation } from '../hooks/queryKeys';
import { PieMenu } from './pie/PieMenu';
import { useContentPieMenu } from '../hooks/useContentPieMenu';
import { motion, AnimatePresence } from 'framer-motion';
import { useContentFocus } from '../hooks/useContentFocus';
import { FocusActionBar } from './FocusActionBar';
import { ContentItemBody } from './ContentItemBody';

interface ContentListProps {
  groupId: string;
  userId?: string;
  newContent?: Content;
  parentContentId?: string | null;
  onNavigate?: (parentId: string | null) => void;
  onFocusContent?: (contentId: string, contentName: string) => void;
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

interface DateDividerProps {
  date: string;
}

const DateDivider: React.FC<DateDividerProps> = ({ date }) => {
  const formatDateDividerLocal = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Normalize to midnight for comparison
    const dateNormalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayNormalized = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (dateNormalized.getTime() === todayNormalized.getTime()) {
      return 'Today';
    } else if (dateNormalized.getTime() === yesterdayNormalized.getTime()) {
      return 'Yesterday';
    } else {
      // Format as "Monday, January 15" or similar
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: dateNormalized.getFullYear() !== todayNormalized.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const label = formatDateDividerLocal(date);

  return (
    <div className="flex items-center my-6 first:mt-0">
      <div className="flex-1 border-t border-gray-200"></div>
      <div className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
        {label}
      </div>
      <div className="flex-1 border-t border-gray-200"></div>
    </div>
  );
};

export const ContentList: React.FC<ContentListProps> = ({
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

  // Track which TSX components have been loaded (lazy loading)
  const [loadedTsxComponents, setLoadedTsxComponents] = useState<Set<string>>(new Set());

  // Hover state for tag button visibility
  // Removed hoveredItemId state - using CSS group-hover instead for better performance

  // Pie menu for tag application
  const {
    isPieMenuOpen,
    pieMenuPosition,
    pieMenuItems,
    handleContextMenu,
    closePieMenu
  } = useContentPieMenu(groupId);

  // Focus mode for single-click content focusing
  const focus = useContentFocus();

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
  // Targeted invalidation: only refetch if the changed content is visible
  useEffect(() => {
    if (!groupId) return;

    const tagsSubscription = contentRepository.subscribeToContentTags(
      groupId,
      (payload) => {
        // Extract content_id from the changed row
        const changedContentId = payload.new?.content_id || payload.old?.content_id;
        if (!changedContentId) return;

        // Always invalidate the specific content item by ID
        queryClient.invalidateQueries({ queryKey: QueryKeys.contentById(changedContentId) });

        // Check if this content item is currently visible in our list
        const contentItems = contentData?.pages.flatMap(page => page.items) ?? [];
        const searchItems = searchData?.pages.flatMap(page => page.items) ?? [];
        const currentItems = isSearching ? searchItems : contentItems;
        const isContentVisible = currentItems.some(item => item.id === changedContentId);

        // Only invalidate list queries if the changed content is visible
        if (isContentVisible) {
          if (isSearching) {
            queryClient.invalidateQueries({ queryKey: QueryKeys.contentSearch(groupId, searchQuery, parentContentId) });
          } else {
            queryClient.invalidateQueries({ queryKey: QueryKeys.contentByParent(groupId, parentContentId) });
          }
        }
      }
    );

    return () => {
      tagsSubscription.unsubscribe();
    };
  }, [groupId, parentContentId, queryClient, isSearching, searchQuery, contentData, searchData]);

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

  // Auto-retry mechanism for stuck queries - must be before early return
  useEffect(() => {
    // Only run if we have a groupId and are not in initial loading
    if (!groupId) return;
    
    const contentItems = contentData?.pages.flatMap(page => page.items) ?? [];
    const searchItems = searchData?.pages.flatMap(page => page.items) ?? [];
    const currentItems = isSearching ? searchItems : contentItems;
    const currentFetching = isSearching ? searchFetching : contentFetching;
    const currentFetchingNext = isSearching ? searchFetchingNext : contentFetchingNext;
    const currentLoading = isSearching ? searchLoading : contentLoading;
    
    // Determine if we're in a stuck loading state (auth refresh issue)
    const isStuckLoading = currentFetching && !currentFetchingNext && !currentLoading && currentItems.length > 0;
    
    if (isStuckLoading) {
      console.warn('Detected stuck loading state, attempting recovery...');
      const timer = setTimeout(() => {
        if (isSearching) {
          queryClient.resetQueries({ queryKey: QueryKeys.contentSearch(groupId, searchQuery, parentContentId) });
        } else {
          queryClient.resetQueries({ queryKey: QueryKeys.contentByParent(groupId, parentContentId) });
        }
      }, 3000); // Wait 3 seconds before reset
      
      return () => clearTimeout(timer);
    }
  }, [groupId, contentData, searchData, isSearching, searchFetching, contentFetching, searchFetchingNext, contentFetchingNext, searchLoading, contentLoading, queryClient, searchQuery, parentContentId]);

  // Realtime subscription for DELETE events
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`content-deletes-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'content',
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          console.log('Content deleted via realtime:', payload);
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
      .channel(`relationships-${parentContentId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'content_relationships',
          filter: `from_content_id=eq.${parentContentId}`
        },
        (payload) => {
          console.log('Relationship changed via realtime:', payload);

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
  const handleContentClick = (contentItem: Content, e?: React.MouseEvent) => {
    // Don't trigger focus if clicking on interactive elements
    if (e) {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, textarea, [role="button"]')) {
        return;
      }
    }

    if (selection.isSelectionMode) {
      // In selection mode, toggle item selection
      selection.toggleItem(contentItem.id);
    } else {
      // Normal mode: toggle focus for this item
      focus.toggleFocus(contentItem.id);
    }
  };

  // Navigate back to parent
  const handleBackClick = () => {
    if (onNavigate) {
      // Find parent of current parent to navigate back
      onNavigate(null); // Simplified - goes back to root
    }
  };

  // Navigate to nested content (for focus mode)
  const handleNavigate = (contentId: string) => {
    if (onNavigate) {
      onNavigate(contentId);
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

  // Get date at midnight (normalized) for grouping
  const getDateKey = (dateString: string): string => {
    const date = new Date(dateString);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
  };

  // Format date for divider display
  const formatDateDivider = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Normalize to midnight for comparison
    const dateNormalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayNormalized = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (dateNormalized.getTime() === todayNormalized.getTime()) {
      return 'Today';
    } else if (dateNormalized.getTime() === yesterdayNormalized.getTime()) {
      return 'Yesterday';
    } else {
      // Format as "Monday, January 15" or similar
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: dateNormalized.getFullYear() !== todayNormalized.getFullYear() ? 'numeric' : undefined
      });
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

  // Flatten the paginated data (memoized to prevent infinite render loops)
  const contentItems = useMemo(
    () => contentData?.pages.flatMap(page => page.items) ?? [],
    [contentData?.pages]
  );
  const tagItems = useMemo(
    () => tagData?.pages.flatMap(page => page.items) ?? [],
    [tagData?.pages]
  );
  const searchItems = useMemo(
    () => searchData?.pages.flatMap(page => page.items) ?? [],
    [searchData?.pages]
  );

  // Determine which data to use based on active mode (memoized to prevent infinite render loops)
  const currentItems = useMemo(
    () => isSearching ? searchItems : (isTagFilterActive ? tagItems : contentItems),
    [isSearching, isTagFilterActive, searchItems, tagItems, contentItems]
  );
  const currentLoading = isSearching ? searchLoading : (isTagFilterActive ? tagLoading : contentLoading);
  // Use persistent items during loading to avoid clearing content immediately
  const displayItems = useMemo(
    () => currentLoading && persistentItems.length > 0 ? persistentItems : currentItems,
    [currentLoading, persistentItems, currentItems]
  );
  const currentFetching = isSearching ? searchFetching : (isTagFilterActive ? tagFetching : contentFetching);
  const currentFetchingNext = isSearching ? searchFetchingNext : (isTagFilterActive ? tagFetchingNext : contentFetchingNext);
  const currentHasMore = isSearching ? searchHasMore : (isTagFilterActive ? tagHasMore : contentHasMore);
  const currentError = isSearching ? searchError : (isTagFilterActive ? tagError : contentError);
  const currentStatus = isSearching ? searchStatus : (isTagFilterActive ? tagStatus : contentStatus);

  // Batch fetch all votes for visible content items to reduce N+1 queries
  const contentIds = useMemo(() => displayItems.map(item => item.id), [displayItems]);
  const { data: batchUserVotesMap } = useBatchUserVotes(contentIds, userId);
  const { data: batchContentVotesMap } = useBatchContentVotes(contentIds);

  // Calculate vote scores for all content items
  const batchVoteScoresMap = useMemo(
    () => batchContentVotesMap ? calculateVoteScoresFromBatch(batchContentVotesMap) : new Map(),
    [batchContentVotesMap]
  );

  // Group content by date
  const groupedContent = useMemo(() => {
    const groups: { [dateKey: string]: Content[] } = {};

    displayItems.forEach(item => {
      const dateKey = getDateKey(item.created_at);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    });

    // Convert to sorted array of [dateKey, items] pairs
    return Object.entries(groups).sort((a, b) => {
      // Sort by date descending (newest first)
      return new Date(b[0]).getTime() - new Date(a[0]).getTime();
    });
  }, [displayItems]);

  // Early return if no group is selected (after all hooks to satisfy Rules of Hooks)
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

  // Skeleton delay effect to prevent flashing
  // useEffect(() => {
  //   if (currentLoading) {
  //     setShowSkeleton(false);
  //     const timer = setTimeout(() => {
  //       setShowSkeleton(true);
  //     }, 200);
  //     return () => clearTimeout(timer);
  //   } else {
  //     setShowSkeleton(false);
  //   }
  // }, [currentLoading]);

  // Memoize items to avoid useEffect dependency issues
  // const memoizedItems = useMemo(() => currentItems, [currentItems.length, parentContentId, isSearching]);
  //
  // // Content persistence effect to maintain smooth transitions
  // useEffect(() => {
  //   if (!currentLoading && memoizedItems.length > 0) {
  //     // Update persistent items when new content is loaded
  //     setPersistentItems(memoizedItems);
  //   }
  //   // Don't update persistent items during loading to maintain current view
  // }, [currentLoading, memoizedItems]);

  return (
    <div className="flex-1 flex flex-col bg-gray-50">

      {/* Content Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {/* Parent Content Display - Always shown when exists, regardless of children */}
        {parentContent && !isSearching && (
          <div className="bg-blue-50 border-b-2 border-blue-200">
            <div className="p-4 sm:p-5">
              <div className="bg-white rounded-lg border border-blue-200 p-4">
                {parentContent.type === 'seo' ? (
                  <div>
                    <SEOCard
                      metadata={parentContent.metadata as SEOMetadata}
                      onClick={() => {}}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(parentContent.created_at)}
                      </p>
                      <TagDisplay tags={parentContent.tags || []} />
                    </div>
                  </div>
                ) : parentContent.type === 'js' ? (
                  <div>
                    <div className="mb-2">
                      <div className="flex items-center space-x-2 mb-2">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        <span className="text-xs font-medium text-green-600 uppercase tracking-wide">JavaScript</span>
                      </div>
                      <JsContentDisplay code={parentContent.data} maxLines={8} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(parentContent.created_at)}
                      </p>
                      <TagDisplay tags={parentContent.tags || []} />
                    </div>
                  </div>
                ) : parentContent.type === 'prompt' ? (
                  <div>
                    <div className="mb-2">
                      <div className="flex items-center space-x-2 mb-2">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                        <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">AI Prompt</span>
                        {parentContent.metadata?.generated_count && (
                          <span className="text-xs text-gray-500">
                            ({parentContent.metadata.generated_count} items generated)
                          </span>
                        )}
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-sm text-purple-800 whitespace-pre-wrap break-words">
                          {parentContent.data}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(parentContent.created_at)}
                      </p>
                      <TagDisplay tags={parentContent.tags || []} />
                    </div>
                  </div>
                ) : parentContent.type === 'epub' ? (
                  <div>
                    <div className="mb-2">
                      <div className="flex items-center space-x-2 mb-2">
                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">Book</span>
                        {parentContent.metadata?.filename && (
                          <span className="text-xs text-gray-500 truncate">
                            {parentContent.metadata.filename}
                          </span>
                        )}
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '500px' }}>
                        <EpubViewer
                          epubUrl={parentContent.data}
                          contentId={parentContent.id}
                          groupId={groupId}
                          filename={parentContent.metadata?.filename}
                          onChildContentCreated={() => {
                            // Invalidate queries to refresh the list
                            queryClient.invalidateQueries({ queryKey: QueryKeys.contentByParent(groupId, parentContent.id) });
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(parentContent.created_at)}
                      </p>
                      <TagDisplay tags={parentContent.tags || []} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <LinkifiedText
                      text={parentContent.data}
                      className="text-gray-900 whitespace-pre-wrap break-words text-sm sm:text-base"
                    />
                    {/* URL Preview Image */}
                    {parentContent.metadata?.url_preview && (
                      <UrlPreviewCard previewUrl={parentContent.metadata.url_preview} />
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        {formatRelativeTime(parentContent.created_at)}
                      </p>
                      <TagDisplay tags={parentContent.tags || []} />
                    </div>
                  </div>
                )}
                {isContentPublic(parentContent) && (
                  <div className="mt-2 flex items-center text-xs text-blue-600">
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    This content is public
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {displayItems.length === 0 && !currentLoading && currentStatus === 'success' && (!parentContent || isSearching) ? (
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
            {/* Child Content Items */}
            <div className={`space-y-3`}>
              {currentLoading && persistentItems.length > 0 && (
                <div className="flex justify-center py-2">
                  <div className="flex items-center text-xs text-gray-600">
                    <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full mr-2"></div>
                    Loading...
                  </div>
                </div>
              )}
              {groupedContent.map(([dateKey, items]) => (
                <React.Fragment key={dateKey}>
                  <DateDivider date={dateKey} />
                  {items.map((item) => {
              const isSelected = selection.selectedItems.has(item.id);
              const ItemContent = () => {
                // Use batch vote data instead of individual query
                const isDownvoted = batchVoteScoresMap?.get(item.id)?.isDownvoted || false;

                return (
                  <div className={`flex-1 min-w-0 ${selection.isSelectionMode ? 'pr-8 sm:pr-10' : ''}`}>
                    {isDownvoted ? (
                      // Compact view for downvoted content
                      <div className="text-sm text-gray-400 truncate opacity-60">
                        {item.data}
                      </div>
                    ) : (
                      // Normal full content view
                      <div>
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
                    ) : item.type === 'tsx' ? (
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">TSX Component</span>
                        </div>
                        {loadedTsxComponents.has(item.id) ? (
                          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                            <TsxRenderer
                              tsxSource={item.data}
                              filename={item.metadata?.filename || `component-${item.id}.tsx`}
                              minHeight={100}
                              maxHeight={800}
                              fallback={
                                <div className="flex items-center gap-2 text-gray-500 p-4">
                                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                  <span>Loading component...</span>
                                </div>
                              }
                              errorFallback={(error) => (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <p className="text-red-600 text-sm">{error.message}</p>
                                </div>
                              )}
                            />
                          </div>
                        ) : (
                          <div
                            className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                            style={{ height: '200px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setLoadedTsxComponents(prev => new Set(prev).add(item.id));
                            }}
                          >
                            <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm mb-2">
                              Load Component
                            </button>
                            <p className="text-xs text-gray-500 font-mono">
                              {item.metadata?.filename || `component-${item.id}.tsx`}
                            </p>
                          </div>
                        )}
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
                    ) : item.type === 'prompt' ? (
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>
                          <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">AI Prompt</span>
                          {item.metadata?.generated_count && (
                            <span className="text-xs text-gray-500">
                              ({item.metadata.generated_count} items generated)
                            </span>
                          )}
                        </div>
                        <TruncatedContent maxHeight={200}>
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                            <p className="text-sm text-purple-800 whitespace-pre-wrap break-words">
                              {item.data}
                            </p>
                          </div>
                        </TruncatedContent>
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
                    ) : item.type === 'claude-code' ? (
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Claude Code</span>
                          {item.metadata?.selected_content_count && (
                            <span className="text-xs text-gray-500">
                              ({item.metadata.selected_content_count} item{item.metadata.selected_content_count !== 1 ? 's' : ''} as context)
                            </span>
                          )}
                        </div>

                        {/* Prompt */}
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-2">
                          <p className="text-sm text-indigo-900 font-medium mb-1">Prompt:</p>
                          <p className="text-sm text-indigo-800 whitespace-pre-wrap break-words">
                            {item.data}
                          </p>
                        </div>

                        {/* Context Used - Collapsible */}
                        {item.metadata?.selected_content && item.metadata.selected_content.length > 0 && (
                          <details className="mb-2">
                            <summary className="cursor-pointer text-xs text-indigo-600 hover:text-indigo-800 font-medium py-1">
                              View Context ({item.metadata.selected_content.length} item{item.metadata.selected_content.length !== 1 ? 's' : ''})
                            </summary>
                            <div className="mt-2 space-y-2 pl-4 border-l-2 border-indigo-200">
                              {item.metadata.selected_content.map((contextItem: any, idx: number) => (
                                <div key={idx} className="bg-gray-50 border border-gray-200 rounded p-2">
                                  <div className="flex items-center gap-1 mb-1">
                                    <span className="text-xs font-medium text-gray-600">{contextItem.type}</span>
                                  </div>
                                  <p className="text-xs text-gray-700 line-clamp-3">
                                    {contextItem.data}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                        <TagDisplay tags={item.tags || []} isVisible={true} />
                        <ContentJobsIndicator jobs={jobsByContentId.get(item.id) || []} className="mt-2" />
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-xs text-gray-500">
                            {formatRelativeTime(item.created_at)}
                          </p>
                          {item.child_count && item.child_count > 0 && (
                            <div className="flex items-center text-xs text-indigo-600" title={`${item.child_count} generated component${item.child_count === 1 ? '' : 's'}`}>
                              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                              </svg>
                              <span>{item.child_count} component{item.child_count === 1 ? '' : 's'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : item.type === 'plugin' ? (
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Plugin</span>
                        </div>

                        {/* Plugin Renderer */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                          <PluginRenderer
                            pluginCode={item.data}
                            contentId={item.id}
                            groupId={item.group_id}
                          />
                        </div>

                        <TagDisplay tags={item.tags || []} isVisible={true} />
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-xs text-gray-500">
                            {formatRelativeTime(item.created_at)}
                          </p>
                          {item.child_count && item.child_count > 0 && (
                            <div className="flex items-center text-xs text-blue-600" title={`${item.child_count} child item${item.child_count === 1 ? '' : 's'}`}>
                              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                              <span>{item.child_count} item{item.child_count === 1 ? '' : 's'}</span>
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
                    ) : item.type === 'epub' ? (
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">Book</span>
                          {item.metadata?.filename && (
                            <span className="text-xs text-gray-500 truncate">
                              {item.metadata.filename}
                            </span>
                          )}
                        </div>
                        <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '500px' }}>
                          <EpubViewer
                            epubUrl={item.data}
                            contentId={item.id}
                            groupId={groupId}
                            filename={item.metadata?.filename}
                            onChildContentCreated={() => {
                              // Invalidate queries to refresh the list
                              queryClient.invalidateQueries({ queryKey: QueryKeys.contentByParent(groupId, item.id) });
                            }}
                          />
                        </div>
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
                    ) : item.type === 'audio' ? (
                      <div>
                        <AudioDisplay
                          audioUrl={item.data}
                          filename={item.metadata?.filename}
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
                    ) : item.type === 'transcript' ? (
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">Transcript</span>
                        </div>
                        <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                          <TranscriptViewer
                            content={item}
                            audioUrl={item.metadata?.source_audio_url || ''}
                          />
                        </div>
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
                    ) : item.type === 'timestamp' ? (
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                            {item.metadata?.timestamp_type === 'range' ? 'Time Range' : 'Timestamp'}
                          </span>
                        </div>
                        <div
                          className="bg-blue-50 border border-blue-200 rounded-lg p-3 cursor-pointer hover:bg-blue-100 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            const youtubeUrl = item.metadata?.youtube_url;
                            const startTime = Math.floor(item.metadata?.start_time || 0);
                            if (youtubeUrl) {
                              const urlWithTimestamp = `${youtubeUrl}${youtubeUrl.includes('?') ? '&' : '?'}t=${startTime}`;
                              window.open(urlWithTimestamp, '_blank');
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-blue-900 mb-1">
                              {item.data}
                            </h4>
                            <svg className="w-4 h-4 text-blue-600 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono text-blue-700 font-medium">
                              {formatTimestamp(item.metadata?.start_time || 0)}
                              {item.metadata?.timestamp_type === 'range' && item.metadata?.end_time &&
                                ` - ${formatTimestamp(item.metadata.end_time)}`
                              }
                            </span>
                          </div>
                          {item.metadata?.description && (
                            <p className="text-xs text-blue-800 mt-1">
                              {item.metadata.description}
                            </p>
                          )}
                        </div>
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
                    ) : item.metadata?.role ? (
                      <div>
                        {/* AI Chat Message */}
                        {item.metadata.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                            </svg>
                            <span className="text-xs font-semibold text-blue-700 uppercase">AI Assistant</span>
                            {item.metadata.streaming && (
                              <div className="flex items-center gap-1 ml-2">
                                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                            )}
                          </div>
                        )}
                        <div className={item.metadata.role === 'assistant' ? 'bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3' : ''}>
                          <LinkifiedText
                            text={item.data}
                            className={`whitespace-pre-wrap break-words text-sm sm:text-base ${
                              item.metadata.error ? 'text-red-800' : 'text-gray-900'
                            }`}
                            maxHeight={200}
                          />
                        </div>
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
                          <TagDisplay tags={item.tags || []} isVisible={true} />
                        </div>
                        <ContentJobsIndicator jobs={jobsByContentId.get(item.id) || []} className="mt-2" />
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
                    )}
                  </div>
                );
              };

              return (
                <motion.div
                  key={item.id}
                  animate={focus.isFocused(item.id) ? { scale: 1.01 } : undefined}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={`group bg-white rounded-lg shadow-sm border p-3 sm:p-4 hover:shadow-md transition-all cursor-pointer relative my-2 ${
                    focus.isFocused(item.id)
                      ? 'ring-2 ring-blue-400 shadow-lg'
                      : ''
                  } ${
                    isSelected
                      ? 'border-blue-500 border-2 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                  onClick={(e) => handleContentClick(item, e)}
                  onContextMenu={(e) => {
                    if (!selection.isSelectionMode) {
                      handleContextMenu(e, item);
                    }
                  }}
                >
                  {/* Selection indicator - better mobile positioning */}
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
                    <ContentItemBody
                      item={item}
                      isDownvoted={batchVoteScoresMap?.get(item.id)?.isDownvoted || false}
                      isSelectionMode={selection.isSelectionMode}
                      jobs={jobsByContentId.get(item.id) || []}
                      groupId={groupId}
                      loadedTsxComponents={loadedTsxComponents}
                      onLoadTsxComponent={(id) => setLoadedTsxComponents(prev => new Set(prev).add(id))}
                      onContentClick={handleContentClick}
                      onInvalidateQueries={(key) => queryClient.invalidateQueries({ queryKey: key })}
                    />

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

                      {/* Vote buttons */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <VoteButtons
                          contentId={item.id}
                          groupId={groupId}
                          isVisible={true}
                          userId={userId}
                          useBatchQueries={true}
                          userVote={batchUserVotesMap?.get(item.id)}
                          voteScore={batchVoteScoresMap?.get(item.id)}
                        />
                      </div>

                      {/* Selection button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!selection.isSelectionMode) {
                            selection.toggleSelectionMode();
                          }
                          selection.toggleItem(item.id);
                        }}
                        className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Select for workflow"
                      >
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>

                      {/* Tag button */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <TagButton
                          contentId={item.id}
                          existingTags={item.tags || []}
                          isVisible={true}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Focus mode action bar */}
                <AnimatePresence mode="wait">
                  {focus.isFocused(item.id) && (
                    <FocusActionBar
                      contentItem={item}
                      groupId={groupId}
                      selection={selection}
                      onNavigate={handleNavigate}
                      hasChildren={!!item.child_count && item.child_count > 0}
                      userId={userId}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
              );
            })}
                </React.Fragment>
              ))}
            </div>

              {/* Show skeleton loading for initial content load (with delay to prevent flashing) */}
              {showSkeleton && (
                <ContentListSkeleton />
              )}

              {/* Background refresh indicator (less prominent) */}
              {currentFetching && !currentLoading && !currentFetchingNext && displayItems.length > 0 && (
              <div className="flex justify-center py-2">
                <div className="flex items-center text-xs text-gray-500">
                  <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full mr-2"></div>
                  Refreshing...
                </div>
              </div>
            )}
            
            {/* Load More Button with better state handling */}
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
            
            {/* Enhanced Error State with Retry */}
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