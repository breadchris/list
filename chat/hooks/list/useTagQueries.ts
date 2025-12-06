import { useQuery } from '@tanstack/react-query';
import { contentRepository, Tag, Content } from '@/lib/list/ContentRepository';
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

/**
 * Query hook for fetching content grouped by tag
 * Returns tagged content map and untagged content array
 */
export const useContentGroupedByTag = (groupId: string, parentId: string | null = null) => {
  return useQuery({
    queryKey: QueryKeys.contentGroupedByTag(groupId, parentId),
    queryFn: async () => {
      const result = await contentRepository.getContentGroupedByTag(groupId, parentId);
      // Convert Map to array for easier consumption in React
      const tagGroups: Array<{ tag: Tag; content: Content[] }> = [];
      result.tagged.forEach((value) => {
        tagGroups.push(value);
      });
      return {
        tagGroups,
        untagged: result.untagged,
      };
    },
    enabled: !!groupId,
    staleTime: 30 * 1000, // 30 seconds - content changes more frequently
    refetchOnWindowFocus: true,
  });
};
