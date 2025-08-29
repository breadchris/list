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
    staleTime: options?.staleTime ?? 30000, // 30 seconds
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
    staleTime: 30000, // 30 seconds
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
    staleTime: 60000, // 1 minute - search results can be cached longer
    // Add a small delay to debounce rapid search queries
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
    staleTime: 60000, // 1 minute
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

      queryClient.setQueryData(queryKey, (old: Content[] | undefined) => {
        return old ? [optimisticContent, ...old] : [optimisticContent];
      });

      // Also update infinite query if it exists
      queryClient.setQueryData(
        QueryKeys.contentByParent(newContent.group_id, newContent.parent_content_id || null),
        (old: any) => {
          if (old?.pages) {
            return {
              ...old,
              pages: old.pages.map((page: any, index: number) => 
                index === 0 
                  ? { ...page, items: [optimisticContent, ...page.items] }
                  : page
              ),
            };
          }
          return old;
        }
      );

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