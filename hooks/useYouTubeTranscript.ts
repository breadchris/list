import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentRepository, Content } from '../components/ContentRepository';
import { QueryKeys } from './queryKeys';

interface TranscriptResult {
  content_id: string;
  success: boolean;
  video_id?: string;
  tracks_found?: number;
  transcript_content_ids?: string[];
  error?: string;
}

interface TranscriptProgressItem {
  contentId: string;
  content: Content;
  status: 'processing' | 'completed' | 'failed';
  transcriptContentIds?: string[];
  error?: string;
}

interface YouTubeTranscriptOptions {
  onProgress?: (item: TranscriptProgressItem) => void;
  selectedContent: Content[];
  useQueue?: boolean;
}

/**
 * Hook for extracting transcripts from YouTube videos
 * Creates transcript content items as children of the video content
 */
export const useYouTubeTranscript = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: YouTubeTranscriptOptions): Promise<TranscriptResult[]> => {
      const { selectedContent, onProgress, useQueue = true } = options;

      // Helper function to check if content is a YouTube video
      const isYouTubeVideo = (content: Content): boolean => {
        // Check metadata for video ID
        if (content.metadata?.youtube_video_id) {
          return true;
        }

        // Check if data contains YouTube URL
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        return youtubeRegex.test(content.data);
      };

      // Filter for YouTube video content only
      const youtubeContent = selectedContent.filter(isYouTubeVideo);

      if (youtubeContent.length === 0) {
        throw new Error('No YouTube video content selected for transcript extraction');
      }

      // Update all to processing status
      youtubeContent.forEach(content => {
        onProgress?.({
          contentId: content.id,
          content,
          status: 'processing'
        });
      });

      console.log(`Starting transcript extraction for ${youtubeContent.length} YouTube video(s)`);
      const result = await contentRepository.extractYouTubeTranscripts(youtubeContent, useQueue);
      console.log('Transcript extraction completed:', result);

      if (result.queued) {
        // Jobs were queued - mark all as processing
        youtubeContent.forEach(content => {
          onProgress?.({
            contentId: content.id,
            content,
            status: 'processing'
          });
        });
        return [];
      }

      // Process results and update progress
      result.data.forEach(item => {
        const content = youtubeContent.find(c => c.id === item.content_id);
        if (!content) return;

        if (item.success) {
          onProgress?.({
            contentId: item.content_id,
            content,
            status: 'completed',
            transcriptContentIds: item.transcript_content_ids
          });
        } else {
          onProgress?.({
            contentId: item.content_id,
            content,
            status: 'failed',
            error: item.error
          });
        }
      });

      return result.data;
    },
    onSuccess: (results, options) => {
      // Invalidate content queries to refresh the lists and show new transcript children
      options.selectedContent.forEach(content => {
        queryClient.invalidateQueries({
          queryKey: QueryKeys.contentByParent
        });
        // Invalidate specific parent to show new child
        queryClient.invalidateQueries({
          queryKey: QueryKeys.contentById(content.id)
        });
      });
    },
    onError: (error) => {
      console.error('YouTube transcript extraction mutation failed:', error);
    }
  });
};
