import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentRepository, Tag } from '../components/ContentRepository';
import { QueryKeys } from './queryKeys';

/**
 * Mutation hook for creating a new tag
 */
export const useCreateTagMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      return await contentRepository.createTag(name, color);
    },
    onSuccess: () => {
      // Invalidate any tag-related queries if we add them later
      // queryClient.invalidateQueries({ queryKey: ['tags'] });
    }
  });
};

/**
 * Mutation hook for adding a tag to content
 */
export const useAddTagToContentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contentId, tagId }: { contentId: string; tagId: string }) => {
      await contentRepository.addTagToContent(contentId, tagId);
      return { contentId, tagId };
    },
    onSuccess: ({ contentId }) => {
      // Invalidate content queries to refetch with updated tags
      queryClient.invalidateQueries({ queryKey: QueryKeys.contentByParent });
      queryClient.invalidateQueries({ queryKey: QueryKeys.contentSearch });
      queryClient.invalidateQueries({ queryKey: QueryKeys.contentById(contentId) });
    }
  });
};

/**
 * Mutation hook for removing a tag from content
 */
export const useRemoveTagFromContentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contentId, tagId }: { contentId: string; tagId: string }) => {
      await contentRepository.removeTagFromContent(contentId, tagId);
      return { contentId, tagId };
    },
    onSuccess: ({ contentId }) => {
      // Invalidate content queries to refetch with updated tags
      queryClient.invalidateQueries({ queryKey: QueryKeys.contentByParent });
      queryClient.invalidateQueries({ queryKey: QueryKeys.contentSearch });
      queryClient.invalidateQueries({ queryKey: QueryKeys.contentById(contentId) });
    }
  });
};

/**
 * Combined hook for all tag operations
 */
export const useTagMutations = () => {
  const createTag = useCreateTagMutation();
  const addTagToContent = useAddTagToContentMutation();
  const removeTagFromContent = useRemoveTagFromContentMutation();

  return {
    createTag,
    addTagToContent,
    removeTagFromContent
  };
};
