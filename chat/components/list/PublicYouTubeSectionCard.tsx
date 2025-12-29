import React, { useState, useRef } from 'react';
import ReactPlayer from 'react-player';
import { formatTime } from '@/utils/list/time';

interface PublicYouTubeSectionCardProps {
  youtubeUrl: string;
  startTime: number;
  endTime: number;
  title: string;
  className?: string;
}

export const PublicYouTubeSectionCard: React.FC<PublicYouTubeSectionCardProps> = ({
  youtubeUrl,
  startTime,
  endTime,
  title,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<ReactPlayer>(null);
  const hasInitialSeeked = useRef(false);

  const sectionDuration = endTime - startTime;

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPlayer(true);
    setIsPlaying(true);
  };

  const handleReady = () => {
    if (playerRef.current && startTime > 0 && !hasInitialSeeked.current) {
      hasInitialSeeked.current = true;
      playerRef.current.currentTime = startTime;
    }
  };

  const handleProgress = (state: { playedSeconds: number }) => {
    const relativeTime = state.playedSeconds;
    setCurrentTime(relativeTime - startTime);

    // Loop back to start if we've reached the end
    if (relativeTime >= endTime) {
      if (playerRef.current) {
        playerRef.current.currentTime = startTime;
      }
    }
  };

  const getVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  const videoId = getVideoId(youtubeUrl);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  const playerUrl = `${youtubeUrl}${youtubeUrl.includes('?') ? '&' : '?'}start=${Math.floor(startTime)}`;

  return (
    <div className={`border border-indigo-200 rounded-lg overflow-hidden bg-indigo-50 ${className}`}>
      {/* Video Player or Thumbnail */}
      <div className="relative aspect-video bg-black">
        {showPlayer ? (
          <ReactPlayer
            ref={playerRef}
            src={playerUrl}
            width="100%"
            height="100%"
            playing={isPlaying}
            controls={true}
            onReady={handleReady}
            onTimeUpdate={handleProgress}
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
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-40 transition-opacity cursor-pointer"
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
        <div className="flex items-center space-x-2 mb-2">
          <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
            Video Section
          </span>
        </div>

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
            ({formatTime(sectionDuration)} loop)
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
      </div>
    </div>
  );
};
