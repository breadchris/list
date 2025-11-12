import { useQuery } from '@tanstack/react-query';
import { ContentRepository, Content } from '../components/ContentRepository';

interface UseRichTextContentOptions {
  contentId: string;
  groupId: string;
  enabled?: boolean;
}

/**
 * Hook to fetch and manage rich text content by ID
 *
 * Uses React Query for caching and automatic refetching.
 *
 * @example
 * const { content, isLoading, error, refetch } = useRichTextContent({
 *   contentId: '123',
 *   groupId: 'abc'
 * });
 */
export function useRichTextContent({
  contentId,
  groupId,
  enabled = true,
}: UseRichTextContentOptions) {
  const contentRepository = new ContentRepository();

  const {
    data: content,
    isLoading,
    error,
    refetch,
  } = useQuery<Content, Error>({
    queryKey: ['content', contentId, groupId],
    queryFn: async () => {
      const result = await contentRepository.getContentById(contentId);

      if (!result) {
        throw new Error(`Content not found: ${contentId}`);
      }

      // Verify content belongs to the correct group
      if (result.group_id !== groupId) {
        throw new Error(`Content does not belong to group: ${groupId}`);
      }

      return result;
    },
    enabled: enabled && !!contentId && !!groupId,
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    retry: 1, // Retry once on failure
  });

  return {
    content,
    isLoading,
    error,
    refetch,
  };
}
