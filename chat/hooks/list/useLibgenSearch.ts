import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentRepository, Content } from '@/lib/list/ContentRepository';
import { QueryKeys } from './queryKeys';

export interface LibgenSearchConfig {
  searchType?: 'default' | 'title' | 'author';
  topics?: string[];
  filters?: Record<string, string>;
  maxResults?: number;
  autoCreate?: boolean; // If false, return book metadata without creating Content items
}

export interface LibgenBook {
  id: string;
  title: string;
  author: string;
  publisher?: string;
  year?: string;
  language?: string;
  pages?: number;
  extension?: string;
  size?: string;
}

export interface LibgenSearchResult {
  content_id: string;
  success: boolean;
  books_found: number;
  books_created: number;
  book_children?: Content[]; // Content items with metadata.libgen containing book data
  error?: string;
}

interface LibgenSearchOptions {
  selectedContent: Content[];
  config: LibgenSearchConfig;
}

/**
 * Hook for searching Libgen books for selected content items
 */
export const useLibgenSearch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: LibgenSearchOptions): Promise<LibgenSearchResult[]> => {
      const { selectedContent, config } = options;

      console.log(`Starting Libgen search for ${selectedContent.length} content items`);

      const result = await contentRepository.searchLibgen(
        selectedContent,
        config.searchType,
        config.topics,
        config.filters,
        config.maxResults,
        config.autoCreate
      );

      console.log(`Libgen search completed:`, result);

      return result.data;
    },
    onSuccess: () => {
      // Invalidate content queries to refresh the lists and show new book children
      queryClient.invalidateQueries({
        queryKey: QueryKeys.contentByParent
      });
    },
    onError: (error) => {
      console.error('Libgen search failed:', error);
    }
  });
};
