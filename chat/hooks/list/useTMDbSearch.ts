import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentRepository, Content } from '@/lib/list/ContentRepository';
import { QueryKeys } from './queryKeys';

export interface TMDbResult {
  tmdb_id: number;
  media_type: string;
  title: string;
  year: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
}

export interface TMDbSearchResult {
  content_id: string;
  success: boolean;
  results: TMDbResult[];
  total_results: number;
  errors?: string[];
}

interface TMDbSearchOptions {
  contentId: string;
  searchType?: 'movie' | 'tv' | 'multi';
  searchQuery?: string;
}

interface TMDbAddOptions {
  groupId: string;
  tmdbIds: number[];
  searchType?: 'movie' | 'tv' | 'multi';
}

/**
 * Hook for searching TMDb without creating content
 */
export const useTMDbSearch = () => {
  return useMutation({
    mutationFn: async (options: TMDbSearchOptions): Promise<TMDbSearchResult> => {
      const { contentId, searchType = 'multi', searchQuery } = options;

      console.log(`Starting TMDb search for content ${contentId}${searchQuery ? ` with query: "${searchQuery}"` : ''}`);
      const result = await contentRepository.searchTMDb(contentId, searchType, searchQuery);
      console.log(`TMDb search completed for content ${contentId}:`, result);

      return result;
    },
    onError: (error) => {
      console.error('TMDb search failed:', error);
    }
  });
};

/**
 * Hook for adding selected TMDb results as content children
 */
export const useTMDbAddResults = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: TMDbAddOptions) => {
      const { groupId, tmdbIds, searchType = 'multi' } = options;

      console.log(`Adding ${tmdbIds.length} TMDb results to group ${groupId}`);
      const result = await contentRepository.addTMDbResults(groupId, tmdbIds, searchType);
      console.log(`TMDb results added to group ${groupId}:`, result);

      return result;
    },
    onSuccess: () => {
      // Invalidate content queries to refresh the lists and show new TMDb children
      queryClient.invalidateQueries({
        queryKey: QueryKeys.contentByParent
      });
    },
    onError: (error) => {
      console.error('TMDb add results failed:', error);
    }
  });
};
