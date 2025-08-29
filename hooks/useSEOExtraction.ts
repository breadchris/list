import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentRepository, Content } from '../components/ContentRepository';
import { QueryKeys } from './queryKeys';

interface SEOExtractionResult {
  seo_children: Content[];
  urls_processed: number;
  total_urls_found: number;
  errors?: string[];
}

/**
 * Hook for extracting SEO information from selected content items
 */
export const useSEOExtraction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contentIds: string[]): Promise<SEOExtractionResult[]> => {
      const results: SEOExtractionResult[] = [];
      const errors: string[] = [];

      for (const contentId of contentIds) {
        try {
          const result = await contentRepository.extractSEOInformation(contentId);
          results.push(result);
        } catch (error) {
          console.error(`SEO extraction failed for content ${contentId}:`, error);
          errors.push(`Failed to extract SEO for item ${contentId}: ${error}`);
        }
      }

      return results;
    },
    onSuccess: (results, contentIds) => {
      // Invalidate content queries to refresh the lists and show new SEO children
      contentIds.forEach(contentId => {
        queryClient.invalidateQueries({
          queryKey: QueryKeys.contentByParent
        });
        queryClient.invalidateQueries({
          queryKey: QueryKeys.seoChildren(contentId)
        });
      });
    },
    onError: (error) => {
      console.error('SEO extraction mutation failed:', error);
    }
  });
};

/**
 * Hook for getting SEO children for a specific content item
 */
export const useSEOChildren = (contentId: string) => {
  return useMutation({
    mutationFn: async (): Promise<Content[]> => {
      return await contentRepository.getSEOChildren(contentId);
    }
  });
};