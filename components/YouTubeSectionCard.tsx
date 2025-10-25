import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player/youtube';
import { useUpdateContentMutation } from '../hooks/useContentQueries';
import { useToast } from './ToastProvider';
import { formatTime } from '../utils/time';

interface YouTubeSectionCardProps {
  contentId: string;
  youtubeUrl: string;
  startTime: number;
  endTime: number;
  title: string;
  metadata?: any;
  className?: string;
  onClick?: () => void;
}

export const YouTubeSectionCard: React.FC<YouTubeSectionCardProps> = ({
  contentId,
  youtubeUrl,
  startTime,
  endTime,
  title,
  metadata = {},
  className = '',
  onClick
}) => {
  // Video player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<ReactPlayer>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editStartTime, setEditStartTime] = useState(startTime);
  const [editEndTime, setEditEndTime] = useState(endTime);
  const [validationError, setValidationError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const updateMutation = useUpdateContentMutation();
  const toast = useToast();
  const isSaving = updateMutation.isPending;

  // Calculate section duration
  const sectionDuration = endTime - startTime;

  // Reset edit values when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      setEditTitle(title);
      setEditStartTime(startTime);
      setEditEndTime(endTime);
      setValidationError(null);
      // Focus title input
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 0);
    }
  }, [isEditMode, title, startTime, endTime]);

  // Validation
  const validateTimes = (start: number, end: number): string | null => {
    if (start < 0) {
      return 'Start time cannot be negative';
    }
    if (end <= start) {
      return 'End time must be after start time';
    }
    if (end - start < 1) {
      return 'Section must be at least 1 second long';
    }
    return null;
  };

  // Handle edit mode toggle
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(true);
  };

  // Handle cancel
  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(false);
    setValidationError(null);
  };

  // Handle save
  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Validate title
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setValidationError('Title cannot be empty');
      return;
    }

    // Validate times
    const timeError = validateTimes(editStartTime, editEndTime);
    if (timeError) {
      setValidationError(timeError);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: contentId,
        updates: {
          data: trimmedTitle,
          metadata: {
            ...metadata,
            start_time: editStartTime,
            end_time: editEndTime
          }
        }
      });

      toast.success('Section updated', 'Your changes have been saved.');
      setIsEditMode(false);
      setValidationError(null);
    } catch (error) {
      console.error('Failed to save section:', error);
      toast.error('Failed to save changes', 'Please try again.');
    }
  };

  // Time adjustment handlers
  const handleStartTimeChange = (delta: number) => {
    const newStart = Math.max(0, editStartTime + delta);
    setEditStartTime(newStart);
    setValidationError(null);
  };

  const handleEndTimeChange = (delta: number) => {
    const newEnd = Math.max(editStartTime + 1, editEndTime + delta);
    setEditEndTime(newEnd);
    setValidationError(null);
  };

  // Handle play button click
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditMode) {
      setShowPlayer(true);
      setIsPlaying(true);
    }
  };

  // Handle card click
  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick && !showPlayer && !isEditMode) {
      e.stopPropagation();
      onClick();
    }
  };

  // Handle progress to loop section
  const handleProgress = (state: { playedSeconds: number }) => {
    const relativeTime = state.playedSeconds;
    setCurrentTime(relativeTime - startTime);

    // Loop back to start if we've reached the end
    if (relativeTime >= endTime) {
      if (playerRef.current) {
        playerRef.current.seekTo(startTime, 'seconds');
      }
    }
  };

  // Extract video ID from URL for thumbnail
  const getVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  const videoId = getVideoId(youtubeUrl);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  // Build YouTube URL with start time
  const playerUrl = `${youtubeUrl}${youtubeUrl.includes('?') ? '&' : '?'}start=${Math.floor(startTime)}`;

  return (
    <div
      className={`border border-indigo-200 rounded-lg overflow-hidden bg-indigo-50 hover:border-indigo-300 transition-all duration-200 ${
        isEditMode ? '' : 'cursor-pointer hover:shadow-md'
      } ${className}`}
      onClick={handleCardClick}
    >
      {/* Video Player or Thumbnail */}
      <div className="relative aspect-video bg-black">
        {showPlayer ? (
          <ReactPlayer
            ref={playerRef}
            url={playerUrl}
            width="100%"
            height="100%"
            playing={isPlaying}
            controls={true}
            onProgress={handleProgress}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            config={{
              youtube: {
                playerVars: {
                  start: Math.floor(startTime),
                  showinfo: 0,
                  modestbranding: 1,
                  rel: 0
                }
              }
            }}
          />
        ) : (
          <>
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            )}

            {/* Play button overlay */}
            <div
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-40 transition-opacity"
              onClick={handlePlayClick}
            >
              <div className="bg-indigo-600 rounded-full p-4 shadow-lg hover:bg-indigo-700 transition-colors">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>

            {/* Section duration badge */}
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded font-medium">
              {formatTime(sectionDuration)}
            </div>
          </>
        )}
      </div>

      {/* Section Info */}
      <div className="p-3 bg-indigo-50">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center space-x-2 flex-1">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
              Video Section
            </span>
          </div>

          {!isEditMode && (
            <div className="flex items-center gap-1">
              {/* Edit button */}
              <button
                onClick={handleEditClick}
                className="flex-shrink-0 p-1 hover:bg-indigo-100 rounded transition-colors"
                title="Edit section"
              >
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>

              {/* External link icon */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(playerUrl, '_blank');
                }}
                className="flex-shrink-0 p-1 hover:bg-indigo-100 rounded transition-colors"
                title="Open in YouTube"
              >
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {isEditMode ? (
          <>
            {/* Edit Mode */}
            <div className="space-y-3">
              {/* Title input */}
              <div>
                <label className="block text-xs font-medium text-indigo-700 mb-1">Title</label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value);
                    setValidationError(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-2 py-1.5 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="Enter section title"
                />
              </div>

              {/* Time controls */}
              <div className="grid grid-cols-2 gap-3">
                {/* Start time */}
                <div>
                  <label className="block text-xs font-medium text-indigo-700 mb-1">Start Time</label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono text-indigo-900 flex-1 text-center">
                      {formatTime(editStartTime)}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartTimeChange(1);
                        }}
                        className="px-2 py-0.5 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded transition-colors"
                        title="Increase by 1 second"
                      >
                        +
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartTimeChange(-1);
                        }}
                        className="px-2 py-0.5 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded transition-colors"
                        title="Decrease by 1 second"
                      >
                        −
                      </button>
                    </div>
                  </div>
                </div>

                {/* End time */}
                <div>
                  <label className="block text-xs font-medium text-indigo-700 mb-1">End Time</label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono text-indigo-900 flex-1 text-center">
                      {formatTime(editEndTime)}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEndTimeChange(1);
                        }}
                        className="px-2 py-0.5 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded transition-colors"
                        title="Increase by 1 second"
                      >
                        +
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEndTimeChange(-1);
                        }}
                        className="px-2 py-0.5 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded transition-colors"
                        title="Decrease by 1 second"
                      >
                        −
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Duration display */}
              <div className="text-xs text-indigo-600 text-center">
                Duration: {formatTime(editEndTime - editStartTime)}
              </div>

              {/* Validation error */}
              {validationError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {validationError}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* View Mode */}
            {/* Section title */}
            <h4 className="text-sm font-semibold text-indigo-900 mb-2 line-clamp-2">
              {title}
            </h4>

            {/* Timeline info */}
            <div className="flex items-center gap-3 text-xs text-indigo-700">
              <div className="flex items-center gap-1 font-mono font-medium">
                <span>{formatTime(startTime)}</span>
                <span>-</span>
                <span>{formatTime(endTime)}</span>
              </div>
              <span className="text-indigo-600">
                ({formatTime(sectionDuration)} section)
              </span>
            </div>

            {/* Progress bar when playing */}
            {showPlayer && sectionDuration > 0 && (
              <div className="mt-2">
                <div className="w-full bg-indigo-200 rounded-full h-1.5">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min((currentTime / sectionDuration) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-indigo-600">
                  <span>{formatTime(Math.max(0, currentTime))}</span>
                  <span>{formatTime(sectionDuration)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Add custom CSS for line clamping
const style = document.createElement('style');
style.textContent = `
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;
if (!document.head.querySelector('style[data-line-clamp]')) {
  style.setAttribute('data-line-clamp', 'true');
  document.head.appendChild(style);
}
