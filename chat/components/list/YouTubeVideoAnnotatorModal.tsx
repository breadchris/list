import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Content, contentRepository } from '@/lib/list/ContentRepository';
import { VideoPlayer } from './video-annotator/VideoPlayer';
import { AnnotationManager } from './video-annotator/AnnotationManager';
import { HorizontalTimeline, TimestampAnnotation, VideoSection } from './video-annotator/HorizontalTimeline';
import { SectionEditor } from './video-annotator/SectionEditor';
import { VideoAnnotation, videoAnnotationToTimestamp } from './video-annotator/types';
import { useToast } from './ToastProvider';
import { Card } from '@/components/ui/card';
import { getYouTubeUrlFromContent } from '@/utils/list/youtubeHelpers';

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

  // Section and loop state
  const [sections, setSections] = useState<VideoSection[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [loopRange, setLoopRange] = useState<{start: number, end: number} | null>(null);
  const lastTimeRef = useRef<number>(0);
  const activeLoopingSectionRef = useRef<string | null>(null);

  const toast = useToast();

  // Load existing timestamp children and sections when modal opens
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

  // Handler functions (must be defined before early return to satisfy Rules of Hooks)
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

  const handleDeleteSection = useCallback((id: string) => {
    // If this section was being looped, disable looping
    if (activeLoopingSectionRef.current === id && isLooping) {
      setIsLooping(false);
      setLoopRange(null);
      activeLoopingSectionRef.current = null;
    }

    setSections(prev => prev.filter(s => s.id !== id));

    if (activeSection === id) {
      setActiveSection(null);
    }
  }, [isLooping, activeSection]);

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

  const handleClose = useCallback(() => {
    // Reset state
    setAnnotations([]);
    setSections([]);
    setActiveSection(null);
    setIsLooping(false);
    setLoopRange(null);
    setCurrentTime(0);
    setVideoDuration(0);
    setIsPlaying(false);
    setSeekTo(undefined);
    activeLoopingSectionRef.current = null;
    onClose();
  }, [onClose]);

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

      // Close modal
      handleClose();
    } catch (error) {
      console.error('Failed to save content:', error);
      toast.error('Failed to save content', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [videoContent, annotations, sections, toast, onTimestampsCreated, handleClose]);

  // Early return after all hooks are defined
  if (!isVisible || !videoContent) return null;

  // Extract YouTube URL from video content using helper function
  const videoUrl = getYouTubeUrlFromContent(videoContent) || '';

  const videoTitle = videoContent.metadata?.youtube_title || videoContent.data.split('\n')[0] || 'YouTube Video';

  // Convert annotations to timestamp format for HorizontalTimeline
  const timestampAnnotations: TimestampAnnotation[] = annotations.map(videoAnnotationToTimestamp);

  // Get active section object
  const activeSectionObject = activeSection ? sections.find(s => s.id === activeSection) || null : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg max-w-full sm:max-w-[1600px] w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center space-x-2">
                <span>🎞️</span>
                <span className="hidden sm:inline">Annotate Video</span>
                <span className="sm:hidden">Annotate</span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate max-w-[200px] sm:max-w-md">
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
        <div className="flex-1 overflow-auto min-h-0">
          <div className="space-y-0">
            <Card className="border shadow-sm overflow-hidden">
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

              {/* Quick Clip Toolbar */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Quick Clip:</span>
                  <button
                    onClick={() => handleQuickClip(10)}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium flex items-center gap-1.5"
                    title="Create section from last 10 seconds"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    Last 10s
                  </button>
                  <button
                    onClick={() => handleQuickClip(30)}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium flex items-center gap-1.5"
                    title="Create section from last 30 seconds"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    Last 30s
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  Current: {Math.floor(currentTime)}s / {Math.floor(videoDuration)}s
                </div>
              </div>

              {/* Section Editor (conditional) */}
              {activeSection && activeSectionObject && (
                <SectionEditor
                  activeSection={activeSectionObject}
                  isLooping={isLooping}
                  onUpdateSectionTitle={handleUpdateSectionTitle}
                  onDeleteSection={handleDeleteSection}
                  onJumpToTimestamp={handleSeekTo}
                  onSetLoopSelection={handleSetLoopSelection}
                  toggleLooping={handleToggleLooping}
                  onClose={() => setActiveSection(null)}
                />
              )}

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
              />
            </Card>

            {/* Annotation Manager - Below timeline */}
            <div className="px-6 py-4">
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
                onQuickClip={handleQuickClip}
                onCreateSection={handleCreateSection}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0">
            <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
              {annotations.length} timestamp{annotations.length !== 1 ? 's' : ''}, {sections.length} section{sections.length !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={handleClose}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm rounded-lg transition-colors ${
                  isSaving || annotations.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                disabled={isSaving || annotations.length === 0}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
