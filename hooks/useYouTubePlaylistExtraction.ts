import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentRepository, Content } from '../components/ContentRepository';
import { QueryKeys } from './queryKeys';

export interface YouTubeProgressItem {
  contentId: string;
  content: Content;
  status: 'processing' | 'completed' | 'failed';
  playlistsFound: number;
  videosCreated: number;
  error?: string;
}

interface YouTubeExtractionResult {
  content_id: string;
  success: boolean;
  playlists_found: number;
  videos_created: number;
  playlist_children?: Content[];
  errors?: string[];
}

interface YouTubeExtractionOptions {
  onProgress?: (item: YouTubeProgressItem) => void;
  selectedContent: Content[];
}

/**
 * Hook for extracting YouTube playlist videos from selected content items with progress tracking
 */
export const useYouTubePlaylistExtraction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: YouTubeExtractionOptions): Promise<YouTubeExtractionResult[]> => {
      const { selectedContent, onProgress } = options;
      const results: YouTubeExtractionResult[] = [];

      for (const content of selectedContent) {
        try {
          // Update status to processing
          onProgress?.({
            contentId: content.id,
            content,
            status: 'processing',
            playlistsFound: 0,
            videosCreated: 0
          });

          console.log(`Starting YouTube playlist extraction for content ${content.id}`);
          const result = await contentRepository.extractYouTubePlaylist(content.id);
          console.log(`YouTube playlist extraction completed for content ${content.id}:`, result);

          results.push(result);

          // Update status to completed with results
          onProgress?.({
            contentId: content.id,
            content,
            status: 'completed',
            playlistsFound: result.playlists_found,
            videosCreated: result.videos_created
          });

        } catch (error) {
          console.error(`YouTube playlist extraction failed for content ${content.id}:`, error);

          // Update status to failed
          onProgress?.({
            contentId: content.id,
            content,
            status: 'failed',
            playlistsFound: 0,
            videosCreated: 0,
            error: error instanceof Error ? error.message : String(error)
          });

          // Still add a result for consistency (with empty data)
          results.push({
            content_id: content.id,
            success: false,
            playlists_found: 0,
            videos_created: 0,
            errors: [String(error)]
          });
        }
      }

      return results;
    },
    onSuccess: (results, options) => {
      // Invalidate content queries to refresh the lists and show new video children
      options.selectedContent.forEach(content => {
        queryClient.invalidateQueries({
          queryKey: QueryKeys.contentByParent
        });
      });
    },
    onError: (error) => {
      console.error('YouTube playlist extraction mutation failed:', error);
    }
  });
};
