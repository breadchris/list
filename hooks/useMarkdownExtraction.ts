import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Content } from '../components/ContentRepository';
import { MarkdownService, MarkdownResult } from '../components/MarkdownService';
import { QueryKeys } from './queryKeys';

export interface MarkdownProgressItem {
  contentId: string;
  content: Content;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  urlsFound: number;
  urlsProcessed: number;
  markdownChildren: any[];
  error?: string;
}

interface MarkdownExtractionOptions {
  onProgress?: (item: MarkdownProgressItem) => void;
  selectedContent: Content[];
}

/**
 * Hook for extracting markdown from URLs in selected content items with progress tracking
 */
export const useMarkdownExtraction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: MarkdownExtractionOptions): Promise<MarkdownResult[]> => {
      const { selectedContent, onProgress } = options;

      // Initialize all items as pending
      selectedContent.forEach(content => {
        onProgress?.({
          contentId: content.id,
          content,
          status: 'pending',
          urlsFound: 0,
          urlsProcessed: 0,
          markdownChildren: []
        });
      });

      // Call the service to extract markdown for all content at once
      const response = await MarkdownService.extractMarkdown(selectedContent);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Markdown extraction failed');
      }

      // Update progress for each result
      response.data.forEach(result => {
        const content = selectedContent.find(c => c.id === result.content_id);
        if (content) {
          onProgress?.({
            contentId: result.content_id,
            content,
            status: result.success ? 'completed' : 'failed',
            urlsFound: result.total_urls_found,
            urlsProcessed: result.urls_processed,
            markdownChildren: result.markdown_children || [],
            error: result.errors?.join(', ')
          });
        }
      });

      return response.data;
    },
    onSuccess: (results, options) => {
      // Invalidate content queries to refresh the lists and show new markdown siblings
      options.selectedContent.forEach(content => {
        queryClient.invalidateQueries({
          queryKey: QueryKeys.contentByParent
        });
      });
    },
    onError: (error) => {
      console.error('Markdown extraction mutation failed:', error);
    }
  });
};
