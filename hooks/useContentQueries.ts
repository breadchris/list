import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Content, contentRepository } from '../components/ContentRepository';
import { QueryKeys, QueryInvalidation } from './queryKeys';

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
  return useQuery({
    queryKey: QueryKeys.contentByParent(groupId, parentId),
    queryFn: async () => {
      if (!groupId) return [];
      return await contentRepository.getContentByParent(groupId, parentId, 0, 20);
    },
    enabled: !!groupId && options?.enabled !== false,
    staleTime: options?.staleTime ?? 300000, // 5 minutes - reduce unnecessary refetching during auth refresh
    gcTime: 600000, // 10 minutes
    refetchOnMount: 'always',
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
  }
) => {
  return useInfiniteQuery({
    queryKey: QueryKeys.contentByParent(groupId, parentId),
    queryFn: async ({ pageParam = 0 }) => {
      if (!groupId) return { items: [], hasMore: false };
      
      const items = await contentRepository.getContentByParent(
        groupId, 
        parentId, 
        pageParam as number, 
        20
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
  }
) => {
  return useInfiniteQuery({
    queryKey: QueryKeys.contentSearch(groupId, query, parentId),
    queryFn: async ({ pageParam = 0 }) => {
      if (!query.trim() || !groupId) return { items: [], hasMore: false };
      
      const items = await contentRepository.searchContent(
        groupId,
        query,
        parentId,
        pageParam as number,
        20
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
 * Mutation for creating content with optimistic updates
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
      return await contentRepository.createContent(content);
    },
    onMutate: async (newContent) => {
      // Cancel any outgoing refetches for this query
      const queryKey = QueryKeys.contentByParent(newContent.group_id, newContent.parent_content_id || null);
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousContent = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      const optimisticContent: Content = {
        id: `temp-${Date.now()}`, // Temporary ID
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        type: newContent.type,
        data: newContent.data,
        group_id: newContent.group_id,
        user_id: '', // Will be filled by the server
        parent_content_id: newContent.parent_content_id || null,
        tags: [],
      };

      // Update infinite query cache (this is what the app actually uses)
      queryClient.setQueryData(queryKey, (old: any) => {
        if (old?.pages) {
          // Handle infinite query structure
          return {
            ...old,
            pages: old.pages.map((page: any, index: number) => 
              index === 0 
                ? { ...page, items: [optimisticContent, ...page.items] }
                : page
            ),
          };
        } else if (Array.isArray(old)) {
          // Handle simple array structure (fallback for non-infinite queries)
          return [optimisticContent, ...old];
        }
        // If no existing data, create initial structure
        return {
          pages: [{ items: [optimisticContent], hasMore: false, nextOffset: 1 }],
          pageParams: [0]
        };
      });

      // Return a context object with the snapshotted value
      return { previousContent, queryKey };
    },
    onError: (err, newContent, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousContent) {
        queryClient.setQueryData(context.queryKey, context.previousContent);
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ 
        queryKey: QueryInvalidation.allContentForGroup(variables.group_id) 
      });
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ 
        queryKey: QueryKeys.contentByParent(variables.group_id, variables.parent_content_id || null)
      });
    },
  });
};

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
    mutationFn: async (contentIds: string[]) => {
      if (contentIds.length === 0) return [];

      // Get all content items first to know which groups to invalidate
      const contentItems = contentIds.map(id =>
        queryClient.getQueryData(QueryKeys.contentById(id)) as Content
      ).filter(Boolean);

      await contentRepository.bulkDeleteContent(contentIds);
      return contentItems;
    },
    onSuccess: (deletedContent) => {
      if (deletedContent && deletedContent.length > 0) {
        // Remove all items from individual caches
        deletedContent.forEach(content => {
          queryClient.removeQueries({ queryKey: QueryKeys.contentById(content.id) });
        });

        // Invalidate content lists for all affected groups
        const affectedGroups = Array.from(
          new Set(deletedContent.map(content => content.group_id))
        );

        affectedGroups.forEach(groupId => {
          queryClient.invalidateQueries({
            queryKey: QueryInvalidation.allContentForGroup(groupId)
          });
        });
      }
    },
  });
};