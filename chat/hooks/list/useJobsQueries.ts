/**
 * React Query hooks for job management
 */

import { useQuery } from '@tanstack/react-query';
import { contentRepository } from '@/lib/list/ContentRepository';
import { QueryKeys } from './queryKeys';
import { useMemo } from 'react';

export interface Job {
  id: string;
  action: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  updated_at: string;
  content_ids?: string[];
  progress?: {
    current?: number;
    total?: number;
    message?: string;
  };
  error?: string;
}

/**
 * Fetch all active jobs for a group
 * More efficient than fetching per content item
 */
export const useActiveJobs = (groupId: string) => {
  const query = useQuery({
    queryKey: QueryKeys.activeJobsByGroup(groupId),
    queryFn: async () => {
      if (!groupId) {
        return [];
      }
      // Fetch only pending and processing jobs
      return await contentRepository.getActiveJobsForGroup(groupId, ['pending', 'processing']);
    },
    enabled: !!groupId,
    staleTime: 1000, // Consider data fresh for 1 second - faster UI updates
    refetchInterval: 30000, // Auto-refetch every 30 seconds
    refetchOnWindowFocus: true,
  });

  // Create a lookup map: contentId -> Job[]
  const jobsByContentId = useMemo(() => {
    const map = new Map<string, Job[]>();

    if (query.data) {
      for (const job of query.data) {
        if (job.content_ids && Array.isArray(job.content_ids)) {
          for (const contentId of job.content_ids) {
            const existing = map.get(contentId) || [];
            map.set(contentId, [...existing, job]);
          }
        }
      }
    }

    return map;
  }, [query.data]);

  return {
    ...query,
    jobsByContentId,
    hasActiveJobs: (query.data?.length || 0) > 0,
  };
};
