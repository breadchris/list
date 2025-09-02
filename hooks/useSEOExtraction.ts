import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentRepository, Content } from '../components/ContentRepository';
import { QueryKeys } from './queryKeys';
import { SEOProgressItem } from '../components/SEOProgressOverlay';

interface SEOExtractionResult {
  seo_children: Content[];
  urls_processed: number;
  total_urls_found: number;
  errors?: string[];
}

interface SEOExtractionOptions {
  onProgress?: (item: SEOProgressItem) => void;
  selectedContent: Content[];
}

/**
 * Hook for extracting SEO information from selected content items with progress tracking
 */
export const useSEOExtraction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: SEOExtractionOptions): Promise<SEOExtractionResult[]> => {
      const { selectedContent, onProgress } = options;
      const results: SEOExtractionResult[] = [];

      for (const content of selectedContent) {
        try {
          // Update status to processing
          onProgress?.({
            contentId: content.id,
            content,
            status: 'processing',
            urlsFound: 0,
            urlsProcessed: 0,
            seoChildren: []
          });

          console.log(`Starting SEO extraction for content ${content.id}`);
          const result = await contentRepository.extractSEOInformation(content.id);
          console.log(`SEO extraction completed for content ${content.id}:`, result);
          
          results.push(result);

          // Update status to completed with results
          onProgress?.({
            contentId: content.id,
            content,
            status: 'completed',
            urlsFound: result.total_urls_found,
            urlsProcessed: result.urls_processed,
            seoChildren: result.seo_children
          });

        } catch (error) {
          console.error(`SEO extraction failed for content ${content.id}:`, error);
          
          // Update status to failed
          onProgress?.({
            contentId: content.id,
            content,
            status: 'failed',
            urlsFound: 0,
            urlsProcessed: 0,
            seoChildren: [],
            error: error instanceof Error ? error.message : String(error)
          });

          // Still add a result for consistency (with empty data)
          results.push({
            seo_children: [],
            urls_processed: 0,
            total_urls_found: 0,
            errors: [String(error)]
          });
        }
      }

      return results;
    },
    onSuccess: (results, options) => {
      // Invalidate content queries to refresh the lists and show new SEO children
      options.selectedContent.forEach(content => {
        queryClient.invalidateQueries({
          queryKey: QueryKeys.contentByParent
        });
        queryClient.invalidateQueries({
          queryKey: QueryKeys.seoChildren(content.id)
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