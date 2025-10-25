import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Layers } from 'lucide-react';
import { Content, contentRepository, Tag, TagFilter, SEOMetadata, SharingMetadata, YouTubeVideoMetadata } from './ContentRepository';
import { LinkifiedText } from './LinkifiedText';
import { SEOCard } from './SEOCard';
import { JsContentDisplay } from './JsContentDisplay';
import { UrlPreviewCard } from './UrlPreviewCard';
import { YouTubeVideoCard } from './YouTubeVideoCard';
import { YouTubeSectionCard } from './YouTubeSectionCard';
import { ImageDisplay } from './ImageDisplay';
import { useToast } from './ToastProvider';
import { useInfiniteContentByParent, useInfiniteSearchContent, useInfiniteContentByTag, useDeleteContentMutation, useContentById } from '../hooks/useContentQueries';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from '../hooks/queryKeys';
import { ContentSelectionState } from '../hooks/useContentSelection';
import { TagButton } from './TagButton';
import { ContentJobsIndicator } from './ContentJobsIndicator';
import { useActiveJobs } from '../hooks/useJobsQueries';

interface ContentDeckProps {
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

// Generate card position based on index (used outside component)
const getCardTransformDefault = (index: number, totalCards: number, isMobile: boolean): { x: number; y: number; rotation: number; zIndex: number } => {
  // Limit visible cards in deck view to prevent performance issues
  const maxVisibleCards = isMobile ? 20 : 30;

  // Parameters for card spread
  const maxRotation = isMobile ? 3 : 5; // degrees
  const spreadRadius = isMobile ? 60 : 120; // pixels
  const verticalSpread = isMobile ? 40 : 80; // pixels
  const stackOffset = isMobile ? 1 : 2; // pixels per card for depth

  // Calculate position in a semi-circular fan pattern
  const angle = (index / Math.min(totalCards, maxVisibleCards)) * Math.PI - Math.PI / 2;
  const rotation = (Math.random() - 0.5) * maxRotation;

  // Position cards in an arc
  const x = Math.cos(angle) * spreadRadius;
  const y = Math.sin(angle) * verticalSpread + index * stackOffset;

  // Z-index decreases with index to stack cards
  const zIndex = maxVisibleCards - index;

  return { x, y, rotation, zIndex };
};

export const ContentDeck: React.FC<ContentDeckProps> = ({
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
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Drag state management
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number; zIndex: number }>>({});
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [preventClick, setPreventClick] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  // localStorage key for custom positions
  const getPositionsKey = () => `deckPositions_${groupId}_${parentContentId || 'root'}`;

  // Load custom positions from localStorage on mount and when context changes
  useEffect(() => {
    const key = getPositionsKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setCustomPositions(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load custom positions:', e);
      }
    } else {
      setCustomPositions({});
    }
  }, [groupId, parentContentId]);

  // Save custom positions to localStorage
  const savePositions = (positions: Record<string, { x: number; y: number; zIndex: number }>) => {
    const key = getPositionsKey();
    localStorage.setItem(key, JSON.stringify(positions));
  };

  // Stack all cards neatly (removed - now defined after currentItems)

  // Responsive breakpoint detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Split tag filters into include and exclude arrays
  const includeTagIds = useMemo(() =>
    selectedTagFilter.filter(tf => tf.mode === 'include').map(tf => tf.tag.id),
    [selectedTagFilter]
  );
  const excludeTagIds = useMemo(() =>
    selectedTagFilter.filter(tf => tf.mode === 'exclude').map(tf => tf.tag.id),
    [selectedTagFilter]
  );

  const isTagFilterActive = selectedTagFilter.length > 0 && !isSearching;

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

  const {
    data: parentContent,
    isLoading: parentLoading
  } = useContentById(
    parentContentId || '',
    { enabled: !!parentContentId && !isSearching }
  );

  const { jobsByContentId } = useActiveJobs(groupId);

  // Real-time subscription for content updates
  useEffect(() => {
    if (!groupId) return;

    const subscription = contentRepository.subscribeToGroupContent(
      groupId,
      (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        const queryKey = QueryKeys.contentByParent(groupId, parentContentId);

        switch (eventType) {
          case 'INSERT':
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

  const handleContentClick = (contentItem: Content) => {
    // Prevent click if we just finished dragging
    if (preventClick) {
      return;
    }

    if (selection.isSelectionMode) {
      selection.toggleItem(contentItem.id);
    } else {
      if (onNavigate) {
        onNavigate(contentItem.id);
      }
    }
  };

  // Drag event handlers
  const handleMouseDown = (e: React.MouseEvent, contentId: string, currentX: number, currentY: number) => {
    // Don't start drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input')) {
      return;
    }

    e.preventDefault();
    setDraggedCardId(contentId);
    hasDragged.current = false; // Reset drag flag

    // Record starting position
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    // Calculate offset from card position to mouse
    setDragOffset({
      x: e.clientX - currentX,
      y: e.clientY - currentY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedCardId) return;

    e.preventDefault();

    // Check if we've moved beyond threshold (5 pixels)
    const deltaX = Math.abs(e.clientX - dragStartPos.current.x);
    const deltaY = Math.abs(e.clientY - dragStartPos.current.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > 5) {
      hasDragged.current = true;
    }

    // Calculate new position
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    // Get the highest z-index currently in use
    const maxZ = Math.max(
      ...Object.values(customPositions).map(p => p.zIndex),
      30 // default max
    );

    // Update position while preserving rotation
    setCustomPositions(prev => ({
      ...prev,
      [draggedCardId]: {
        x: newX,
        y: newY,
        zIndex: maxZ + 1, // Bring to front
        rotation: prev[draggedCardId]?.rotation ?? 0 // Preserve rotation
      }
    }));
  };

  const handleMouseUp = () => {
    if (!draggedCardId) return;

    // If we actually dragged, prevent the click event
    if (hasDragged.current) {
      setPreventClick(true);
      // Reset the flag after the click event has had a chance to fire
      setTimeout(() => setPreventClick(false), 0);
    }

    // Save positions to localStorage
    savePositions(customPositions);
    setDraggedCardId(null);
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent, contentId: string, currentX: number, currentY: number, currentRotation: number) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input')) {
      return;
    }

    const touch = e.touches[0];
    setDraggedCardId(contentId);
    hasDragged.current = false; // Reset drag flag

    dragStartPos.current = { x: touch.clientX, y: touch.clientY };

    setDragOffset({
      x: touch.clientX - currentX,
      y: touch.clientY - currentY
    });

    // If card doesn't have custom position yet, initialize with current rotation
    if (!customPositions[contentId]) {
      setCustomPositions(prev => ({
        ...prev,
        [contentId]: {
          x: currentX,
          y: currentY,
          zIndex: 30,
          rotation: currentRotation
        }
      }));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggedCardId) return;

    e.preventDefault();
    const touch = e.touches[0];

    // Check if we've moved beyond threshold (5 pixels)
    const deltaX = Math.abs(touch.clientX - dragStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - dragStartPos.current.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > 5) {
      hasDragged.current = true;
    }

    const newX = touch.clientX - dragOffset.x;
    const newY = touch.clientY - dragOffset.y;

    const maxZ = Math.max(
      ...Object.values(customPositions).map(p => p.zIndex),
      30
    );

    setCustomPositions(prev => ({
      ...prev,
      [draggedCardId]: {
        x: newX,
        y: newY,
        zIndex: maxZ + 1,
        rotation: prev[draggedCardId]?.rotation ?? 0 // Preserve rotation
      }
    }));
  };

  const handleTouchEnd = () => {
    if (!draggedCardId) return;

    // If we actually dragged, prevent the click event
    if (hasDragged.current) {
      setPreventClick(true);
      // Reset the flag after the click event has had a chance to fire
      setTimeout(() => setPreventClick(false), 0);
    }

    savePositions(customPositions);
    setDraggedCardId(null);
  };

  // Add global mouse/touch move and up listeners when dragging
  useEffect(() => {
    if (!draggedCardId) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggedCardId) return;

      // Check if we've moved beyond threshold (5 pixels)
      const deltaX = Math.abs(e.clientX - dragStartPos.current.x);
      const deltaY = Math.abs(e.clientY - dragStartPos.current.y);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > 5) {
        hasDragged.current = true;
      }

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      const maxZ = Math.max(
        ...Object.values(customPositions).map(p => p.zIndex),
        30
      );

      setCustomPositions(prev => ({
        ...prev,
        [draggedCardId]: {
          x: newX,
          y: newY,
          zIndex: maxZ + 1,
          rotation: prev[draggedCardId]?.rotation ?? 0
        }
      }));
    };

    const handleGlobalMouseUp = () => {
      if (draggedCardId) {
        // If we actually dragged, prevent the click event
        if (hasDragged.current) {
          setPreventClick(true);
          // Reset the flag after the click event has had a chance to fire
          setTimeout(() => setPreventClick(false), 0);
        }

        savePositions(customPositions);
        setDraggedCardId(null);
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchmove', handleGlobalMouseMove as any);
    document.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalMouseMove as any);
      document.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [draggedCardId, dragOffset, customPositions]);

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

  const contentItems = contentData?.pages.flatMap(page => page.items) ?? [];
  const tagItems = tagData?.pages.flatMap(page => page.items) ?? [];
  const searchItems = searchData?.pages.flatMap(page => page.items) ?? [];

  const currentItems = isSearching ? searchItems : (isTagFilterActive ? tagItems : contentItems);
  const currentLoading = isSearching ? searchLoading : (isTagFilterActive ? tagLoading : contentLoading);
  const currentFetching = isSearching ? searchFetching : (isTagFilterActive ? tagFetching : contentFetching);
  const currentFetchingNext = isSearching ? searchFetchingNext : (isTagFilterActive ? tagFetchingNext : contentFetchingNext);
  const currentHasMore = isSearching ? searchHasMore : (isTagFilterActive ? tagHasMore : contentHasMore);
  const currentError = isSearching ? searchError : (isTagFilterActive ? tagError : contentError);
  const currentStatus = isSearching ? searchStatus : (isTagFilterActive ? tagStatus : contentStatus);

  // Stack all cards neatly in a pile at center position
  const handleStackCards = () => {
    // Center position for the stack
    const centerX = 0; // Center of container
    const centerY = 0; // Center of container

    const stackedPositions: Record<string, { x: number; y: number; zIndex: number; rotation: number }> = {};

    currentItems.forEach((item, index) => {
      stackedPositions[item.id] = {
        x: centerX,
        y: centerY + (index * 0.5), // Tiny vertical offset (0.5px per card) for realistic depth
        zIndex: currentItems.length - index, // Higher cards have higher z-index
        rotation: 0 // No rotation for neat stack
      };
    });

    setCustomPositions(stackedPositions);
    savePositions(stackedPositions);
  };

  const renderContentItem = (item: Content, index: number, total: number) => {
    const isSelected = selection.selectedItems.has(item.id);
    const isDragging = draggedCardId === item.id;

    // Check if card has custom position, otherwise use calculated position
    const hasCustomPosition = customPositions[item.id];
    let cardStyle: React.CSSProperties;
    let currentX = 0;
    let currentY = 0;
    let currentRotation = 0;

    if (hasCustomPosition) {
      // Use custom dragged position with preserved rotation
      currentX = hasCustomPosition.x;
      currentY = hasCustomPosition.y;
      currentRotation = hasCustomPosition.rotation;
      cardStyle = {
        position: 'absolute',
        transform: `translate(${currentX}px, ${currentY}px) rotate(${currentRotation}deg)`,
        zIndex: isDragging ? 1000 : hasCustomPosition.zIndex,
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease-out',
        userSelect: 'none',
      };
    } else {
      // Use calculated position from algorithm
      const maxVisibleCards = isMobile ? 20 : 30;
      if (index >= maxVisibleCards) {
        cardStyle = { display: 'none' };
      } else {
        const pos = getCardTransformDefault(index, total, isMobile);
        currentX = pos.x;
        currentY = pos.y;
        currentRotation = pos.rotation;
        cardStyle = {
          position: 'absolute',
          transform: `translate(${pos.x}px, ${pos.y}px) rotate(${pos.rotation}deg)`,
          zIndex: pos.zIndex,
          cursor: 'grab',
          transition: 'transform 0.3s ease-out, box-shadow 0.2s ease-out',
          userSelect: 'none',
        };
      }
    }

    return (
      <div
        key={item.id}
        style={cardStyle}
        className={`bg-white rounded-lg shadow-md border p-3 sm:p-4 hover:shadow-xl w-72 sm:w-80 ${
          isSelected
            ? 'border-blue-500 border-2 bg-blue-50'
            : 'border-gray-200'
        } ${isDragging ? 'shadow-2xl scale-105' : ''}`}
        onClick={() => handleContentClick(item)}
        onMouseDown={(e) => handleMouseDown(e, item.id, currentX, currentY, currentRotation)}
        onTouchStart={(e) => handleTouchStart(e, item.id, currentX, currentY, currentRotation)}
        onMouseEnter={() => setHoveredItemId(item.id)}
        onMouseLeave={() => setHoveredItemId(null)}
      >
        {selection.isSelectionMode && (
          <div className="absolute top-3 right-3 z-10">
            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center ${
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
          <div className={`flex-1 min-w-0 ${selection.isSelectionMode ? 'pr-8 sm:pr-10' : ''}`}>
            {item.metadata?.youtube_video_id || item.metadata?.extracted_from_playlist ? (
              <div>
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
                    <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested item${item.child_count === 1 ? '' : 's'}`}>
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
                  className="text-gray-900 whitespace-pre-wrap break-words text-sm"
                  maxHeight={150}
                />
                {item.metadata?.url_preview && (
                  <UrlPreviewCard previewUrl={item.metadata.url_preview} />
                )}
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-xs text-gray-500">
                    {formatRelativeTime(item.created_at)}
                  </p>
                  {item.child_count && item.child_count > 0 && (
                    <div className="flex items-center text-xs text-gray-400" title={`${item.child_count} nested item${item.child_count === 1 ? '' : 's'}`}>
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>{item.child_count}</span>
                    </div>
                  )}
                  <TagDisplay tags={item.tags || []} isVisible={true} />
                </div>
                <ContentJobsIndicator jobs={jobsByContentId.get(item.id) || []} className="mt-2" />
              </div>
            )}
          </div>

          {!selection.isSelectionMode && (
            <div className="flex flex-col items-center gap-1 w-8">
              {isContentPublic(item) && (
                <div className="flex-shrink-0" title="This content is public">
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}

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
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onScroll={handleScroll}
      >
        {currentItems.length === 0 && !currentLoading && currentStatus === 'success' ? (
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
          <div className="relative min-h-screen p-8">
            {/* Deck container with centered positioning */}
            <div className="flex items-center justify-center min-h-[600px]">
              <div className="relative" style={{ width: isMobile ? '300px' : '600px', height: isMobile ? '400px' : '600px' }}>
                {currentItems.map((item, index) => renderContentItem(item, index, currentItems.length))}
              </div>
            </div>

            {/* Stack Cards Button - Stack all cards neatly (always visible) */}
            <div className="fixed bottom-20 right-6 z-50">
              <button
                onClick={handleStackCards}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 hover:shadow-xl transition-all text-sm font-medium text-gray-700"
                title="Stack all cards neatly"
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">Stack Cards</span>
              </button>
            </div>

            {currentFetching && !currentLoading && !currentFetchingNext && currentItems.length > 0 && (
              <div className="flex justify-center py-2 mt-8">
                <div className="flex items-center text-xs text-gray-500">
                  <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full mr-2"></div>
                  Refreshing...
                </div>
              </div>
            )}

            {currentHasMore && currentItems.length > 0 && (
              <div className="flex justify-center py-4 mt-8">
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

            {currentError && (
              <div className="flex justify-center py-4 mt-8">
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
              <div className="text-center py-4 mt-8 text-gray-500 text-sm">
                {isSearching ? 'No more search results' : 'No more items'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
