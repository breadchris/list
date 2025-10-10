import React, { useState } from 'react';
import { Content, contentRepository } from './ContentRepository';
import { VideoPlayer } from './video-annotator/VideoPlayer';
import { AnnotationManager } from './video-annotator/AnnotationManager';
import { VideoAnnotation } from './video-annotator/types';
import { useToast } from './ToastProvider';

interface YouTubeVideoAnnotatorModalProps {
  isVisible: boolean;
  videoContent: Content | null;
  onClose: () => void;
  onTimestampsCreated: () => void;
}

export const YouTubeVideoAnnotatorModal: React.FC<YouTubeVideoAnnotatorModalProps> = ({
  isVisible,
  videoContent,
  onClose,
  onTimestampsCreated
}) => {
  const [annotations, setAnnotations] = useState<VideoAnnotation[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekTo, setSeekTo] = useState<number | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const toast = useToast();

  if (!isVisible || !videoContent) return null;

  // Extract YouTube URL from video content
  const getYouTubeUrl = (): string => {
    // First try metadata.youtube_url
    if (videoContent.metadata?.youtube_url) {
      return videoContent.metadata.youtube_url;
    }

    // Fallback: construct from video ID
    if (videoContent.metadata?.youtube_video_id) {
      return `https://www.youtube.com/watch?v=${videoContent.metadata.youtube_video_id}`;
    }

    // Last resort: extract from data field
    const lines = videoContent.data.split('\n');
    const urlLine = lines.find(line => line.includes('youtube.com') || line.includes('youtu.be'));
    return urlLine || '';
  };

  const videoUrl = getYouTubeUrl();

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleDurationChange = (duration: number) => {
    setVideoDuration(duration);
  };

  const handlePlayStateChange = (playing: boolean) => {
    setIsPlaying(playing);
  };

  const handleAnnotationsChange = (newAnnotations: VideoAnnotation[]) => {
    setAnnotations(newAnnotations);
  };

  const handleSeekTo = (time: number) => {
    setSeekTo(time);
    // Reset seekTo after a moment to allow multiple seeks to the same time
    setTimeout(() => setSeekTo(undefined), 100);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSave = async () => {
    if (annotations.length === 0) {
      toast.info('No timestamps to save', 'Please add at least one timestamp before saving.');
      return;
    }

    setIsSaving(true);

    try {
      // Create timestamp content items as children of the video
      const timestampPromises = annotations.map(async (annotation) => {
        return await contentRepository.createContent({
          type: 'timestamp',
          data: annotation.title,
          group_id: videoContent.group_id,
          parent_content_id: videoContent.id,
          metadata: {
            start_time: annotation.startTime,
            end_time: annotation.endTime,
            description: annotation.description,
            youtube_video_id: videoContent.metadata?.youtube_video_id,
            youtube_url: videoUrl,
            timestamp_type: annotation.type
          }
        });
      });

      await Promise.all(timestampPromises);

      toast.success('Timestamps saved!', `Created ${annotations.length} timestamp${annotations.length !== 1 ? 's' : ''}.`);

      // Notify parent to refresh content
      onTimestampsCreated();

      // Close modal
      handleClose();
    } catch (error) {
      console.error('Failed to save timestamps:', error);
      toast.error('Failed to save timestamps', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setAnnotations([]);
    setCurrentTime(0);
    setVideoDuration(0);
    setIsPlaying(false);
    setSeekTo(undefined);
    onClose();
  };

  const videoTitle = videoContent.metadata?.youtube_title || videoContent.data.split('\n')[0] || 'YouTube Video';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-[1600px] w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                <span>🎞️</span>
                <span>Annotate Video</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1 truncate max-w-md">
                {videoTitle}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSaving}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Video Player - Takes 2 columns on large screens */}
            <div className="lg:col-span-2">
              <VideoPlayer
                videoUrl={videoUrl}
                annotations={annotations}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
                onPlayStateChange={handlePlayStateChange}
                seekTo={seekTo}
              />
            </div>

            {/* Annotation Manager - Takes 1 column on large screens */}
            <div className="lg:col-span-1 h-full">
              <AnnotationManager
                annotations={annotations}
                currentTime={currentTime}
                videoDuration={videoDuration}
                onAnnotationsChange={handleAnnotationsChange}
                onSeekTo={handleSeekTo}
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {annotations.length} timestamp{annotations.length !== 1 ? 's' : ''} created
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isSaving || annotations.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                disabled={isSaving || annotations.length === 0}
              >
                {isSaving ? 'Saving...' : 'Save Timestamps'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
