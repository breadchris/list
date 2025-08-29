import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Group, contentRepository } from '../components/ContentRepository';
import { QueryKeys, QueryInvalidation } from './queryKeys';

/**
 * Hook for fetching user groups with caching
 */
export const useGroupsQuery = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: QueryKeys.groups,
    queryFn: async () => {
      return await contentRepository.getUserGroups();
    },
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes - groups change less frequently
    refetchOnWindowFocus: false, // Don't refetch groups on focus
  });
};

/**
 * Hook for fetching a single group by ID
 */
export const useGroupByIdQuery = (groupId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: QueryKeys.groupById(groupId),
    queryFn: async () => {
      return await contentRepository.getGroupById(groupId);
    },
    enabled: !!groupId && options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Mutation for creating a new group
 */
export const useCreateGroupMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      return await contentRepository.createGroup(name);
    },
    onMutate: async (groupName) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: QueryKeys.groups });

      // Snapshot the previous value
      const previousGroups = queryClient.getQueryData(QueryKeys.groups);

      // Optimistically update to the new value
      const optimisticGroup: Group = {
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        name: groupName,
        join_code: 'TEMP',
        created_by: undefined,
      };

      queryClient.setQueryData(QueryKeys.groups, (old: Group[] | undefined) => {
        return old ? [optimisticGroup, ...old] : [optimisticGroup];
      });

      return { previousGroups };
    },
    onError: (err, newGroup, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousGroups) {
        queryClient.setQueryData(QueryKeys.groups, context.previousGroups);
      }
    },
    onSuccess: (data) => {
      // Remove optimistic update and add real data
      queryClient.invalidateQueries({ queryKey: QueryKeys.groups });
      
      // Cache the new group individually
      queryClient.setQueryData(QueryKeys.groupById(data.id), data);
    },
  });
};

/**
 * Mutation for joining a group by code
 */
export const useJoinGroupMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (joinCode: string) => {
      return await contentRepository.joinGroupByCode(joinCode);
    },
    onSuccess: (data) => {
      // Invalidate groups query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: QueryKeys.groups });
      
      // Cache the joined group individually
      queryClient.setQueryData(QueryKeys.groupById(data.id), data);
    },
  });
};

/**
 * Custom hook to get a specific group from the cached groups list
 */
export const useGroupFromCache = (groupId: string | null): Group | null => {
  const { data: groups } = useGroupsQuery();
  
  if (!groupId || !groups) return null;
  
  return groups.find(group => group.id === groupId) || null;
};