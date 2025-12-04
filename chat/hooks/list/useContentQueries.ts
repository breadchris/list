import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Content, contentRepository } from '@/lib/list/ContentRepository';
import { QueryKeys, QueryInvalidation } from './queryKeys';
import { getFirstUrl } from '@/utils/list/urlDetection';
import { shouldGenerateScreenshot } from '@/utils/list/urlHandlerConfig';
import { getFeatureFlag } from '@/utils/list/featureFlags';

/**
 * Hook for fetching public content children (accessible to anonymous users)
 */
export const usePublicContentChildren = (parentId: string | null, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['public-content-children', parentId],
    queryFn: async () => {
      if (!parentId) return [];
      return await contentRepository.getPublicContentChildren(parentId);
    },
    enabled: !!parentId && options?.enabled !== false,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });
};

/**
 * Hook for fetching paginated content by parent
 */
export const useContentByParent = (
  groupId: string,
  parentId: string | null,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) => {
  // Check if query caching feature flag is enabled
  const enableQueryCaching = getFeatureFlag('enableQueryCaching');

  return useQuery({
    queryKey: QueryKeys.contentByParent(groupId, parentId),
    queryFn: async () => {
      if (!groupId) return [];
      return await contentRepository.getContentByParent(groupId, parentId, 0, 20);
    },
    enabled: !!groupId && options?.enabled !== false,
    staleTime: options?.staleTime ?? 300000, // 5 minutes - reduce unnecessary refetching during auth refresh
    gcTime: 600000, // 10 minutes
    refetchOnMount: enableQueryCaching ? false : 'always', // Use cache when feature flag enabled
    refetchOnWindowFocus: false, // Prevent refetch on window focus during auth events
    refetchOnReconnect: true
  });
};

/**
 * Hook for infinite scrolling content by parent
 */
export const useInfiniteContentByParent = (
  groupId: string,
  parentId: string | null,
  options?: {
    enabled?: boolean;
    viewMode?: 'chronological' | 'random' | 'alphabetical' | 'oldest';
  }
) => {
  const viewMode = options?.viewMode || 'chronological';

  return useInfiniteQuery({
    queryKey: [...QueryKeys.contentByParent(groupId, parentId), viewMode],
    queryFn: async ({ pageParam = 0 }) => {
      if (!groupId) return { items: [], hasMore: false };

      const items = await contentRepository.getContentByParent(
        groupId,
        parentId,
        pageParam as number,
        20,
        viewMode
      );

      return {
        items,
        hasMore: items.length === 20,
        nextOffset: (pageParam as number) + items.length,
      };
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextOffset : undefined;
    },
    initialPageParam: 0,
    enabled: !!groupId && options?.enabled !== false,
    staleTime: 180000, // 3 minutes - balance between freshness and stability
    gcTime: 600000, // 10 minutes
    refetchOnMount: false, // Prevent refetch on component remount during auth
    refetchOnWindowFocus: false, // Critical: prevent refetch during auth token refresh
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Don't retry during auth transitions
      if (error?.message?.includes('JWT') || error?.message?.includes('auth')) {
        return false;
      }
      return failureCount < 2;
    }
  });
};

/**
 * Hook for fetching a single content item by ID
 */
export const useContentById = (contentId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: QueryKeys.contentById(contentId),
    queryFn: async () => {
      return await contentRepository.getContentById(contentId);
    },
    enabled: !!contentId && options?.enabled !== false,
    staleTime: 60000, // 1 minute - individual items change less frequently
  });
};

/**
 * Hook for searching content with debouncing
 */
export const useSearchContent = (
  groupId: string,
  query: string,
  parentId: string | null = null,
  options?: {
    enabled?: boolean;
    debounceMs?: number;
  }
) => {
  return useQuery({
    queryKey: QueryKeys.contentSearch(groupId, query, parentId),
    queryFn: async () => {
      if (!query.trim() || !groupId) return [];
      return await contentRepository.searchContent(groupId, query, parentId, 0, 20);
    },
    enabled: !!groupId && !!query.trim() && options?.enabled !== false,
    staleTime: 300000, // 5 minutes - search results can be cached longer during auth refresh
    gcTime: 600000, // 10 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false, // Prevent refetch during auth events
    refetchOnReconnect: true
  });
};

/**
 * Hook for infinite search results
 */
export const useInfiniteSearchContent = (
  groupId: string,
  query: string,
  parentId: string | null = null,
  options?: {
    enabled?: boolean;
    viewMode?: 'chronological' | 'random' | 'alphabetical' | 'oldest';
  }
) => {
  const viewMode = options?.viewMode || 'chronological';

  return useInfiniteQuery({
    queryKey: [...QueryKeys.contentSearch(groupId, query, parentId), viewMode],
    queryFn: async ({ pageParam = 0 }) => {
      if (!query.trim() || !groupId) return { items: [], hasMore: false };

      const items = await contentRepository.searchContent(
        groupId,
        query,
        parentId,
        pageParam as number,
        20,
        viewMode
      );

      return {
        items,
        hasMore: items.length === 20,
        nextOffset: (pageParam as number) + items.length,
      };
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextOffset : undefined;
    },
    initialPageParam: 0,
    enabled: !!groupId && !!query.trim() && options?.enabled !== false,
    staleTime: 300000, // 5 minutes - longer cache for search results
    gcTime: 600000, // 10 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false, // Prevent refetch during auth events
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Don't retry during auth transitions
      if (error?.message?.includes('JWT') || error?.message?.includes('auth')) {
        return false;
      }
      return failureCount < 2;
    }
  });
};

/**
 * Hook for infinite scrolling content filtered by tags
 * Supports:
 * - Include tags (AND logic - content must have ALL include tags)
 * - Exclude tags (NOT logic - content must NOT have ANY exclude tags)
 */
export const useInfiniteContentByTag = (
  groupId: string,
  parentId: string | null,
  includeTagIds: string[],
  excludeTagIds: string[] = [],
  options?: {
    enabled?: boolean;
    viewMode?: 'chronological' | 'random' | 'alphabetical' | 'oldest';
  }
) => {
  const viewMode = options?.viewMode || 'chronological';

  return useInfiniteQuery({
    queryKey: [...QueryKeys.contentByTag(groupId, parentId, [...includeTagIds, ...excludeTagIds.map(id => `!${id}`)]), viewMode],
    queryFn: async ({ pageParam = 0 }) => {
      if (!groupId || (includeTagIds.length === 0 && excludeTagIds.length === 0)) {
        return { items: [], hasMore: false };
      }

      const items = await contentRepository.getContentByParentAndTag(
        groupId,
        parentId,
        includeTagIds,
        excludeTagIds,
        pageParam as number,
        20,
        viewMode
      );

      return {
        items,
        hasMore: items.length === 20,
        nextOffset: (pageParam as number) + items.length,
      };
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextOffset : undefined;
    },
    initialPageParam: 0,
    enabled: !!groupId && (includeTagIds.length > 0 || excludeTagIds.length > 0) && options?.enabled !== false,
    staleTime: 180000, // 3 minutes
    gcTime: 600000, // 10 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      // Don't retry during auth transitions
      if (error?.message?.includes('JWT') || error?.message?.includes('auth')) {
        return false;
      }
      return failureCount < 2;
    }
  });
};

/**
 * Mutation for creating content - no optimistic updates per CLAUDE.md guidelines
 * Automatically generates URL previews for content containing URLs
 */
export const useCreateContentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: {
      type: string;
      data: string;
      group_id: string;
      parent_content_id?: string;
    }) => {
      // Create the content first
      const createdContent = await contentRepository.createContent(content);

      // Check if content contains URLs and generate preview asynchronously
      const firstUrl = getFirstUrl(content.data);
      if (firstUrl && shouldGenerateScreenshot(firstUrl)) {
        // Don't await this - let it run in background
        generateUrlPreviewAsync(createdContent.id, firstUrl);
      }

      return createdContent;
    },
    onSuccess: (data, variables) => {
      // After successful creation, invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: QueryKeys.contentByParent(variables.group_id, variables.parent_content_id || null)
      });
      queryClient.invalidateQueries({
        queryKey: QueryInvalidation.allContentForGroup(variables.group_id)
      });
    },
  });
};

/**
 * Async function to generate URL preview without blocking content creation
 * Includes retry logic for rate limiting
 */
async function generateUrlPreviewAsync(contentId: string, url: string) {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [5000, 30000, 60000]; // 5s, 30s, 1m

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`Starting URL preview generation for ${contentId} (attempt ${attempt + 1})`);

      const result = await contentRepository.generateUrlPreview(contentId, url);

      if (result.success && result.screenshot_url) {
        await contentRepository.updateContentUrlPreview(contentId, result.screenshot_url);
        console.log(`Successfully generated and saved URL preview for ${contentId}`);
        return; // Success - exit retry loop
      } else if (result.error?.includes('Rate limit') && attempt < MAX_RETRIES - 1) {
        // Rate limited - wait and retry
        const delay = RETRY_DELAYS[attempt];
        console.log(`Rate limited for ${contentId}, retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      } else {
        console.warn(`URL preview generation failed for ${contentId}:`, result.error);
        return; // Non-retriable error
      }
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) {
        console.error(`Background URL preview generation failed for ${contentId} after ${MAX_RETRIES} attempts:`, error);
      } else {
        console.warn(`URL preview attempt ${attempt + 1} failed for ${contentId}:`, error);
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
      }
    }
  }
}

/**
 * Mutation for updating content
 */
export const useUpdateContentMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Content> }) => {
      return await contentRepository.updateContent(id, updates);
    },
    onSuccess: (data) => {
      // Update the individual content cache
      queryClient.setQueryData(QueryKeys.contentById(data.id), data);
      
      // Invalidate content lists that might contain this item
      queryClient.invalidateQueries({ 
        queryKey: QueryInvalidation.allContentForGroup(data.group_id) 
      });
    },
  });
};

/**
 * Mutation for deleting content
 */
export const useDeleteContentMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contentId: string) => {
      // Get the content first to know which queries to invalidate
      const content = queryClient.getQueryData(QueryKeys.contentById(contentId)) as Content;
      await contentRepository.deleteContent(contentId);
      return content;
    },
    onSuccess: (deletedContent) => {
      if (deletedContent) {
        // Remove from all relevant caches
        queryClient.removeQueries({ queryKey: QueryKeys.contentById(deletedContent.id) });
        
        // Invalidate content lists
        queryClient.invalidateQueries({
          queryKey: QueryInvalidation.allContentForGroup(deletedContent.group_id)
        });
      }
    },
  });
};

/**
 * Mutation for bulk deleting multiple content items
 */
export const useBulkDeleteContentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contentIds, groupId }: { contentIds: string[]; groupId: string }) => {
      if (contentIds.length === 0) return { contentIds: [], groupId };

      await contentRepository.bulkDeleteContent(contentIds);
      return { contentIds, groupId };
    },
    onSuccess: ({ contentIds, groupId }) => {
      // Remove all items from individual caches
      contentIds.forEach(id => {
        queryClient.removeQueries({ queryKey: QueryKeys.contentById(id) });
      });

      // Invalidate content lists for the affected group
      queryClient.invalidateQueries({
        queryKey: QueryInvalidation.allContentForGroup(groupId)
      });
    },
  });
};

/**
 * Query hook for fetching all tag-filter content items for a group
 * Tag filters are cached and automatically refreshed when needed
 */
export const useTagFiltersForGroup = (groupId: string) => {
  return useQuery({
    queryKey: QueryKeys.tagFiltersByGroup(groupId),
    queryFn: async () => {
      return await contentRepository.getTagFiltersForGroup(groupId);
    },
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000, // 5 minutes - tag filters don't change frequently
    refetchOnWindowFocus: true,
  });
};

/**
 * Query hook for fetching all parent content items for a given content ID
 * Returns parents with their relationship metadata
 */
export const useParentsForContent = (contentId: string) => {
  return useQuery({
    queryKey: QueryKeys.parentsByContent(contentId),
    queryFn: async () => {
      return await contentRepository.getParentsForContent(contentId);
    },
    enabled: !!contentId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Mutation for creating a relationship between two content items
 */
export const useCreateRelationshipMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (relationship: {
      from_content_id: string;
      to_content_id: string;
      display_order?: number;
    }) => {
      return await contentRepository.createRelationship(relationship);
    },
    onSuccess: (createdRelationship) => {
      // Invalidate parent and child queries for both content items
      queryClient.invalidateQueries({
        queryKey: QueryKeys.parentsByContent(createdRelationship.to_content_id)
      });
      queryClient.invalidateQueries({
        queryKey: QueryKeys.childrenByContent(createdRelationship.from_content_id)
      });
      // Also invalidate content queries to update child counts
      queryClient.invalidateQueries({
        queryKey: QueryKeys.content
      });
    },
  });
};

/**
 * Mutation for deleting a relationship between two content items
 */
export const useDeleteRelationshipMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ relationshipId, fromContentId, toContentId }: {
      relationshipId: string;
      fromContentId: string;
      toContentId: string;
    }) => {
      await contentRepository.deleteRelationship(relationshipId);
      return { fromContentId, toContentId };
    },
    onSuccess: ({ fromContentId, toContentId }) => {
      // Invalidate parent and child queries for both content items
      queryClient.invalidateQueries({
        queryKey: QueryKeys.parentsByContent(toContentId)
      });
      queryClient.invalidateQueries({
        queryKey: QueryKeys.childrenByContent(fromContentId)
      });
      // Also invalidate content queries to update child counts
      queryClient.invalidateQueries({
        queryKey: QueryKeys.content
      });
    },
  });
};