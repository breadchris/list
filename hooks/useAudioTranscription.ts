import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contentRepository, Content } from '../components/ContentRepository';
import { QueryKeys } from './queryKeys';

interface TranscriptionResult {
  content_id: string;
  success: boolean;
  transcript_content_id?: string;
  error?: string;
}

interface TranscriptionProgressItem {
  contentId: string;
  content: Content;
  status: 'processing' | 'completed' | 'failed';
  transcriptContentId?: string;
  error?: string;
}

interface AudioTranscriptionOptions {
  onProgress?: (item: TranscriptionProgressItem) => void;
  selectedContent: Content[];
  useQueue?: boolean;
}

/**
 * Hook for transcribing audio files using Deepgram API
 * Creates transcript content items as children of the audio content
 */
export const useAudioTranscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: AudioTranscriptionOptions): Promise<TranscriptionResult[]> => {
      const { selectedContent, onProgress, useQueue = true } = options;

      // Filter for audio content only
      const audioContent = selectedContent.filter(c => c.type === 'audio');

      if (audioContent.length === 0) {
        throw new Error('No audio content selected for transcription');
      }

      // Update all to processing status
      audioContent.forEach(content => {
        onProgress?.({
          contentId: content.id,
          content,
          status: 'processing'
        });
      });

      console.log(`Starting transcription for ${audioContent.length} audio file(s)`);
      const result = await contentRepository.transcribeAudio(audioContent, useQueue);
      console.log('Transcription completed:', result);

      if (result.queued) {
        // Jobs were queued - mark all as processing
        audioContent.forEach(content => {
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
        const content = audioContent.find(c => c.id === item.content_id);
        if (!content) return;

        if (item.success) {
          onProgress?.({
            contentId: item.content_id,
            content,
            status: 'completed',
            transcriptContentId: item.transcript_content_id
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
      console.error('Audio transcription mutation failed:', error);
    }
  });
};
