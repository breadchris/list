import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Content, Tag, contentRepository } from '@/lib/list/ContentRepository';
import { VideoPlayer } from './video-annotator/VideoPlayer';
import { AnnotationManager } from './video-annotator/AnnotationManager';
import { HorizontalTimeline, TimestampAnnotation, VideoSection } from './video-annotator/HorizontalTimeline';
import { VideoAnnotation, videoAnnotationToTimestamp } from './video-annotator/types';
import { useToast } from './ToastProvider';
import { Card } from '@/components/ui/card';
import { getYouTubeUrlFromContent } from '@/utils/list/youtubeHelpers';
import { ContentInput } from './ContentInput';

interface YouTubeVideoAnnotatorPageProps {
  videoContent: Content | null;
  onClose: () => void;
  onTimestampsCreated: () => void;
  availableTags?: Tag[];
}

export const YouTubeVideoAnnotatorPage: React.FC<YouTubeVideoAnnotatorPageProps> = ({
  videoContent,
  onClose,
  onTimestampsCreated,
  availableTags = []
}) => {
  const [annotations, setAnnotations] = useState<VideoAnnotation[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekTo, setSeekTo] = useState<number | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  // Section and loop state
  const [sections, setSections] = useState<VideoSection[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [loopRange, setLoopRange] = useState<{start: number, end: number} | null>(null);
  const lastTimeRef = useRef<number>(0);
  const activeLoopingSectionRef = useRef<string | null>(null);

  const toast = useToast();

  // Load existing timestamp children and sections when page loads
  useEffect(() => {
    const loadExistingData = async () => {
      if (!videoContent?.id) return;

      try {
        const children = await contentRepository.getContentByParent(
          videoContent.group_id,
          videoContent.id
        );

        // Load timestamps
        const timestamps = children
          .filter(c => c.type === 'timestamp')
          .map(c => ({
            id: c.id,
            title: c.data,
            description: c.metadata?.description || '',
            startTime: c.metadata?.start_time || 0,
            endTime: c.metadata?.end_time || 0,
            type: (c.metadata?.timestamp_type || 'marker') as 'marker' | 'range'
          }));

        // Load sections
        const sectionItems = children
          .filter(c => c.type === 'video_section')
          .map(c => ({
            id: c.id,
            title: c.data,
            startTime: c.metadata?.start_time || 0,
            endTime: c.metadata?.end_time || 0,
            timestampIds: c.metadata?.timestamp_ids || []
          }));

        setAnnotations(timestamps);
        setSections(sectionItems);
      } catch (error) {
        console.error('Failed to load existing data:', error);
      }
    };

    loadExistingData();
  }, [videoContent?.id]);

  // Handler functions
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleDurationChange = useCallback((duration: number) => {
    setVideoDuration(duration);
  }, []);

  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handleAnnotationsChange = useCallback((newAnnotations: VideoAnnotation[]) => {
    setAnnotations(newAnnotations);
  }, []);

  const handleSeekTo = useCallback((time: number) => {
    setSeekTo(time);
    // Reset seekTo after a moment to allow multiple seeks to the same time
    setTimeout(() => setSeekTo(undefined), 100);
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Section management handlers
  const handleAddAnnotation = useCallback((timestamp: number) => {
    const newAnnotation: VideoAnnotation = {
      id: crypto.randomUUID(),
      title: `Timestamp ${annotations.length + 1}`,
      description: '',
      startTime: timestamp,
      endTime: timestamp,
      type: 'marker'
    };
    setAnnotations(prev => [...prev, newAnnotation]);
  }, [annotations.length]);

  const handleCreateSection = useCallback((startTime: number, endTime: number, timestampIds: string[]) => {
    const title = prompt("Enter a title for this section:", `Section ${sections.length + 1}`);
    if (!title) return;

    const sectionId = crypto.randomUUID();
    const newSection: VideoSection = {
      id: sectionId,
      title: title.trim(),
      startTime,
      endTime,
      timestampIds
    };

    setSections(prev => [...prev, newSection]);
    setActiveSection(sectionId);
  }, [sections.length]);

  const handleUpdateSectionTitle = useCallback((id: string, title: string) => {
    setSections(prev =>
      prev.map(section =>
        section.id === id ? { ...section, title } : section
      )
    );
  }, []);

  const handleUpdateSectionBoundary = useCallback((id: string, startTime: number, endTime: number) => {
    setSections(prev =>
      prev.map(section =>
        section.id === id ? { ...section, startTime, endTime } : section
      )
    );

    // If this section is being looped, update the loop range
    if (isLooping && activeLoopingSectionRef.current === id) {
      setLoopRange({ start: startTime, end: endTime });
    }
  }, [isLooping]);

  const handleDeleteSection = useCallback(async (id: string) => {
    // If this section was being looped, disable looping
    if (activeLoopingSectionRef.current === id && isLooping) {
      setIsLooping(false);
      setLoopRange(null);
      activeLoopingSectionRef.current = null;
    }

    try {
      // Delete from database
      await contentRepository.deleteContent(id);
      toast.success('Section deleted', 'The section has been removed.');

      // Update local state
      setSections(prev => prev.filter(s => s.id !== id));

      if (activeSection === id) {
        setActiveSection(null);
      }
    } catch (error) {
      console.error('Error deleting section:', error);
      toast.error('Delete failed', 'Could not delete the section. Please try again.');
    }
  }, [isLooping, activeSection, toast]);

  const handleDeleteAnnotation = useCallback(async (id: string) => {
    try {
      // Delete from database
      await contentRepository.deleteContent(id);
      toast.success('Timestamp deleted', 'The timestamp has been removed.');

      // Update local state
      setAnnotations(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting annotation:', error);
      toast.error('Delete failed', 'Could not delete the timestamp. Please try again.');
    }
  }, [toast]);

  const handleUpdateAnnotation = useCallback(async (id: string, newTimestamp: number) => {
    // Update local state immediately for smooth dragging
    setAnnotations(prev =>
      prev.map(annotation =>
        annotation.id === id
          ? { ...annotation, startTime: newTimestamp, endTime: newTimestamp }
          : annotation
      )
    );

    // Update in database (async, non-blocking)
    try {
      const annotation = annotations.find(a => a.id === id);
      if (!annotation || !videoContent) return;

      await contentRepository.updateContent(id, {
        metadata: {
          start_time: newTimestamp,
          end_time: newTimestamp,
          description: annotation.description,
          youtube_video_id: videoContent.metadata?.youtube_video_id,
          youtube_url: getYouTubeUrlFromContent(videoContent) || '',
          timestamp_type: annotation.type
        }
      });
    } catch (error) {
      console.error('Error updating annotation:', error);
      // Silently fail during drag - don't disrupt the UX
    }
  }, [annotations, videoContent]);

  const handleSetLoopSelection = useCallback((startTime: number, endTime: number, sectionId?: string) => {
    setLoopRange({ start: startTime, end: endTime });

    if (sectionId) {
      activeLoopingSectionRef.current = sectionId;
    } else {
      activeLoopingSectionRef.current = null;
    }
  }, []);

  const handleToggleLooping = useCallback(() => {
    setIsLooping(prev => !prev);

    if (isLooping) {
      activeLoopingSectionRef.current = null;
    }
  }, [isLooping]);

  const handleQuickClip = useCallback((duration: 10 | 30) => {
    const endTime = currentTime;
    const startTime = Math.max(0, currentTime - duration);

    const sectionId = crypto.randomUUID();
    const newSection: VideoSection = {
      id: sectionId,
      title: `Quick Clip (${duration}s)`,
      startTime,
      endTime,
      timestampIds: []
    };

    setSections(prev => [...prev, newSection]);
    setActiveSection(sectionId);

    toast.success('Quick Clip Created', `Captured ${duration}s ending at ${Math.floor(endTime)}s`);
  }, [currentTime, toast]);

  const handleSave = useCallback(async () => {
    if (!videoContent) return;
    if (annotations.length === 0 && sections.length === 0) {
      toast.info('Nothing to save', 'Please add at least one timestamp or section before saving.');
      return;
    }

    // Extract YouTube URL from video content using helper function
    const videoUrl = getYouTubeUrlFromContent(videoContent) || '';

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

      // Create section content items as children of the video
      const sectionPromises = sections.map(async (section) => {
        return await contentRepository.createContent({
          type: 'video_section',
          data: section.title,
          group_id: videoContent.group_id,
          parent_content_id: videoContent.id,
          metadata: {
            start_time: section.startTime,
            end_time: section.endTime,
            timestamp_ids: section.timestampIds,
            youtube_video_id: videoContent.metadata?.youtube_video_id,
            youtube_url: videoUrl
          }
        });
      });

      await Promise.all([...timestampPromises, ...sectionPromises]);

      const totalItems = annotations.length + sections.length;
      toast.success('Content saved!', `Created ${annotations.length} timestamp${annotations.length !== 1 ? 's' : ''} and ${sections.length} section${sections.length !== 1 ? 's' : ''}.`);

      // Notify parent to refresh content
      onTimestampsCreated();

      // Close and return to content list
      onClose();
    } catch (error) {
      console.error('Failed to save content:', error);
      toast.error('Failed to save content', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [videoContent, annotations, sections, toast, onTimestampsCreated, onClose]);

  if (!videoContent) return null;

  // Extract YouTube URL from video content using helper function
  const videoUrl = getYouTubeUrlFromContent(videoContent) || '';
  const videoTitle = videoContent.metadata?.youtube_title || videoContent.data.split('\n')[0] || 'YouTube Video';

  // Convert annotations to timestamp format for HorizontalTimeline
  const timestampAnnotations: TimestampAnnotation[] = annotations.map(videoAnnotationToTimestamp);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSaving}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>
          <h1 className="text-lg font-semibold text-gray-900 truncate max-w-xs sm:max-w-md lg:max-w-2xl">
            {videoTitle}
          </h1>
        </div>

        <button
          onClick={handleSave}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isSaving || (annotations.length === 0 && sections.length === 0)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          disabled={isSaving || (annotations.length === 0 && sections.length === 0)}
        >
          {isSaving ? 'Saving...' : `Save (${annotations.length + sections.length})`}
        </button>
      </header>

      {/* Main Content - Responsive Grid */}
      <main className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:grid lg:grid-cols-[70%_30%]">
        {/* Left/Top: Video Section */}
        <div className="flex flex-col flex-shrink-0 lg:flex-shrink lg:overflow-y-auto bg-white lg:border-r border-gray-200">
          <Card className="border-0 shadow-none overflow-hidden m-4 lg:m-0">
            {/* Video Player */}
            <div className="bg-black relative aspect-video flex items-center justify-center overflow-hidden">
              <VideoPlayer
                videoUrl={videoUrl}
                annotations={annotations}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
                onPlayStateChange={handlePlayStateChange}
                seekTo={seekTo}
                isLooping={isLooping}
                loopRange={loopRange}
              />

              {/* Loop indicator */}
              {isLooping && loopRange && (
                <div className="absolute top-2 right-2 bg-green-600 text-white px-3 py-1 rounded-full text-sm flex items-center z-20 bg-opacity-80 shadow-md">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Looping</span>
                </div>
              )}
            </div>

            {/* Horizontal Timeline */}
            <HorizontalTimeline
              currentTime={currentTime}
              duration={videoDuration}
              annotations={timestampAnnotations}
              sections={sections}
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              onAddAnnotation={handleAddAnnotation}
              onCreateSection={handleCreateSection}
              onJumpToTimestamp={handleSeekTo}
              onSetLoopSelection={handleSetLoopSelection}
              isLooping={isLooping}
              toggleLooping={handleToggleLooping}
              onUpdateSectionBoundary={handleUpdateSectionBoundary}
              onUpdateAnnotation={handleUpdateAnnotation}
            />
          </Card>
        </div>

        {/* Right/Bottom: Annotations Section */}
        <div className="flex flex-col lg:h-full lg:overflow-y-auto bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-200">
          {/* Annotation Manager */}
          <div className="lg:flex-1 lg:overflow-y-auto p-4">
            <AnnotationManager
              annotations={annotations}
              sections={sections}
              currentTime={currentTime}
              videoDuration={videoDuration}
              onAnnotationsChange={handleAnnotationsChange}
              onSeekTo={handleSeekTo}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onSectionClick={setActiveSection}
              onSectionDelete={handleDeleteSection}
              onSectionUpdate={handleUpdateSectionTitle}
              onDeleteAnnotation={handleDeleteAnnotation}
              onQuickClip={handleQuickClip}
              onCreateSection={handleCreateSection}
            />
          </div>
        </div>
      </main>

      {/* Fixed Bottom Input for Notes */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-800 border-t border-gray-700 shadow-lg">
        <ContentInput
          groupId={videoContent.group_id}
          parentContentId={videoContent.id}
          onContentAdded={() => {
            // Notes saved as children of video - no action needed
          }}
          availableTags={availableTags}
        />
      </div>
    </div>
  );
};
