import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Group, InviteStats, InviteGraphNode, contentRepository } from '@/lib/list/ContentRepository';
import { QueryKeys, QueryInvalidation } from './queryKeys';
import { supabase } from '@/lib/list/SupabaseClient';

/**
 * Hook for fetching user groups with caching
 */
export const useGroupsQuery = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: QueryKeys.groups,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return []; // Return empty for unauthenticated users
      }
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
    onSuccess: (data) => {
      // Invalidate groups query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: QueryKeys.groups });

      // Cache the new group individually
      queryClient.setQueryData(QueryKeys.groupById(data.id), data);
    },
  });
};

/**
 * Mutation for joining a group with user invite code
 */
export const useJoinGroupMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      return await contentRepository.joinGroupWithUserCode(inviteCode);
    },
    onSuccess: (data) => {
      // Invalidate groups query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: QueryKeys.groups });

      // Cache the joined group individually
      queryClient.setQueryData(QueryKeys.groupById(data.id), data);

      // Invalidate invite-related queries
      queryClient.invalidateQueries({ queryKey: ['invite-stats'] });
      queryClient.invalidateQueries({ queryKey: ['invite-graph', data.id] });
    },
  });
};

/**
 * Mutation for leaving a group
 */
export const useLeaveGroupMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      return await contentRepository.leaveGroup(groupId);
    },
    onSuccess: (_, groupId) => {
      // Invalidate groups query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: QueryKeys.groups });

      // Remove the group from cache
      queryClient.removeQueries({ queryKey: QueryKeys.groupById(groupId) });

      // Invalidate invite-related queries
      queryClient.invalidateQueries({ queryKey: ['invite-stats'] });
      queryClient.invalidateQueries({ queryKey: ['invite-graph', groupId] });

      // Invalidate content queries for this group
      queryClient.removeQueries({ queryKey: ['content-by-parent', groupId] });
      queryClient.removeQueries({ queryKey: ['content-search', groupId] });
    },
  });
};

/**
 * Hook for fetching user invite codes/stats
 */
export const useUserInviteStatsQuery = (groupId?: string) => {
  return useQuery({
    queryKey: ['invite-stats', groupId],
    queryFn: async () => {
      return await contentRepository.getUserInviteCodes(groupId);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Hook for fetching invite graph for a group
 */
export const useInviteGraphQuery = (groupId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['invite-graph', groupId],
    queryFn: async () => {
      return await contentRepository.getInviteGraph(groupId);
    },
    enabled: !!groupId && options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Mutation for creating user invite code
 */
export const useCreateInviteCodeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, maxUses, expiresAt }: {
      groupId: string;
      maxUses?: number;
      expiresAt?: string;
    }) => {
      return await contentRepository.createUserInviteCode(groupId, maxUses, expiresAt);
    },
    onSuccess: (data, variables) => {
      // Invalidate invite stats
      queryClient.invalidateQueries({ queryKey: ['invite-stats'] });
      queryClient.invalidateQueries({ queryKey: ['invite-stats', variables.groupId] });
    },
  });
};

/**
 * Mutation for deactivating an invite code
 */
export const useDeactivateInviteCodeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteCodeId: string) => {
      return await contentRepository.deactivateInviteCode(inviteCodeId);
    },
    onSuccess: () => {
      // Invalidate invite stats to refresh the list
      queryClient.invalidateQueries({ queryKey: ['invite-stats'] });
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