import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentRepository, Content } from '@/lib/list/ContentRepository';
import { QueryInvalidation } from './queryKeys';

interface BulkMarkAsPublicOptions {
  contentItems: Content[];
  onProgress?: (current: number, total: number, itemName: string) => void;
}

interface BulkMarkAsPublicResult {
  successCount: number;
  failureCount: number;
  total: number;
  failures: Array<{ id: string; title: string; error: string }>;
}

export const useBulkMarkAsPublic = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contentItems, onProgress }: BulkMarkAsPublicOptions): Promise<BulkMarkAsPublicResult> => {
      const total = contentItems.length;
      let successCount = 0;
      let failureCount = 0;
      const failures: Array<{ id: string; title: string; error: string }> = [];

      for (let i = 0; i < contentItems.length; i++) {
        const item = contentItems[i];
        const itemName = item.data?.title || item.data?.name || item.data?.text || 'Untitled';

        try {
          if (onProgress) {
            onProgress(i + 1, total, itemName);
          }

          const response = await contentRepository.toggleContentSharing(item.id, true);

          if (response.success) {
            successCount++;
          } else {
            failureCount++;
            failures.push({
              id: item.id,
              title: itemName,
              error: 'Failed to update sharing status'
            });
          }
        } catch (error) {
          failureCount++;
          failures.push({
            id: item.id,
            title: itemName,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return {
        successCount,
        failureCount,
        total,
        failures
      };
    },
    onSuccess: (result, variables) => {
      // Invalidate queries for all affected groups
      const groupIds = [...new Set(variables.contentItems.map(item => item.group_id))];

      groupIds.forEach(groupId => {
        queryClient.invalidateQueries({
          queryKey: QueryInvalidation.allContentForGroup(groupId)
        });
      });

      // Also invalidate individual content queries
      variables.contentItems.forEach(item => {
        queryClient.invalidateQueries({
          queryKey: ['content', item.id]
        });
      });
    }
  });
};
