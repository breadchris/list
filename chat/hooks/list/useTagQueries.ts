import { useQuery } from '@tanstack/react-query';
import { contentRepository } from '@/lib/list/ContentRepository';
import { QueryKeys } from './queryKeys';

/**
 * Query hook for fetching all tags used in a group's content
 * Tags are cached and automatically refreshed when needed
 */
export const useTagsForGroup = (groupId: string) => {
  return useQuery({
    queryKey: QueryKeys.tagsByGroup(groupId),
    queryFn: async () => {
      return await contentRepository.getTagsForGroup(groupId);
    },
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000, // 5 minutes - tags don't change frequently
    refetchOnWindowFocus: true,
  });
};
