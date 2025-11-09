import { useQuery } from '@tanstack/react-query';
import { supabase } from '../components/SupabaseClient';
import { Content } from '../components/ContentRepository';

/**
 * Hook for fetching all votes for a content item
 */
export const useContentVotes = (contentId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['content-votes', contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('parent_content_id', contentId)
        .eq('type', 'vote');

      if (error) {
        console.error('Error fetching content votes:', error);
        throw error;
      }

      return data as Content[];
    },
    enabled: options?.enabled !== false,
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
  });
};

/**
 * Hook for fetching the current user's vote on a content item
 */
export const useUserVote = (contentId: string, userId: string | null, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['user-vote', contentId, userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('parent_content_id', contentId)
        .eq('type', 'vote')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching user vote:', error);
        throw error;
      }

      // Handle multiple votes by taking the most recent one
      return (data?.[0] as Content) || null;
    },
    enabled: !!userId && !!contentId && (options?.enabled !== false),
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
  });
};

/**
 * Hook for calculating vote score and determining if content is downvoted
 */
export const useVoteScore = (contentId: string, options?: { enabled?: boolean }) => {
  const { data: votes = [] } = useContentVotes(contentId, options);

  const upvotes = votes.filter(v => v.data === 'upvote').length;
  const downvotes = votes.filter(v => v.data === 'downvote').length;
  const score = upvotes - downvotes;
  const isDownvoted = score < 0;

  return {
    upvotes,
    downvotes,
    score,
    isDownvoted,
  };
};

/**
 * Hook for checking if content is downvoted (convenience hook)
 */
export const useIsDownvoted = (contentId: string) => {
  const { isDownvoted } = useVoteScore(contentId);
  return isDownvoted;
};

/**
 * Hook for batch fetching user votes for multiple content items
 * Reduces N queries to 1 query
 */
export const useBatchUserVotes = (contentIds: string[], userId: string | null) => {
  return useQuery({
    queryKey: ['batch-user-votes', contentIds, userId],
    queryFn: async () => {
      if (!userId || contentIds.length === 0) return new Map<string, Content | null>();

      const { data, error } = await supabase
        .from('content')
        .select('*')
        .in('parent_content_id', contentIds)
        .eq('type', 'vote')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching batch user votes:', error);
        throw error;
      }

      // Group votes by parent_content_id, taking most recent for each
      const votesMap = new Map<string, Content>();
      (data as Content[]).forEach(vote => {
        const parentId = vote.parent_content_id;
        if (parentId && !votesMap.has(parentId)) {
          votesMap.set(parentId, vote);
        }
      });

      return votesMap;
    },
    enabled: !!userId && contentIds.length > 0,
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
  });
};

/**
 * Hook for batch fetching all votes for multiple content items
 * Reduces N queries to 1 query
 */
export const useBatchContentVotes = (contentIds: string[]) => {
  return useQuery({
    queryKey: ['batch-content-votes', contentIds],
    queryFn: async () => {
      if (contentIds.length === 0) return new Map<string, Content[]>();

      const { data, error } = await supabase
        .from('content')
        .select('*')
        .in('parent_content_id', contentIds)
        .eq('type', 'vote');

      if (error) {
        console.error('Error fetching batch content votes:', error);
        throw error;
      }

      // Group votes by parent_content_id
      const votesMap = new Map<string, Content[]>();
      (data as Content[]).forEach(vote => {
        const parentId = vote.parent_content_id;
        if (parentId) {
          const existing = votesMap.get(parentId) || [];
          votesMap.set(parentId, [...existing, vote]);
        }
      });

      return votesMap;
    },
    enabled: contentIds.length > 0,
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
  });
};

/**
 * Calculate vote scores from batch votes data
 */
export const calculateVoteScoresFromBatch = (votesMap: Map<string, Content[]>) => {
  const scoresMap = new Map<string, { upvotes: number; downvotes: number; score: number; isDownvoted: boolean }>();

  votesMap.forEach((votes, contentId) => {
    const upvotes = votes.filter(v => v.data === 'upvote').length;
    const downvotes = votes.filter(v => v.data === 'downvote').length;
    const score = upvotes - downvotes;
    const isDownvoted = score < 0;

    scoresMap.set(contentId, { upvotes, downvotes, score, isDownvoted });
  });

  return scoresMap;
};
