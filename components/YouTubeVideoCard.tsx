import React from 'react';
import { YouTubeVideoMetadata } from './ContentRepository';

interface YouTubeVideoCardProps {
  metadata: YouTubeVideoMetadata;
  videoUrl: string;
  className?: string;
  onClick?: () => void;
}

export const YouTubeVideoCard: React.FC<YouTubeVideoCardProps> = ({
  metadata,
  videoUrl,
  className = '',
  onClick
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (videoUrl) {
      window.open(videoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      handleClick(e);
    }
  };

  // Get the best quality thumbnail
  const getThumbnailUrl = () => {
    if (!metadata.youtube_thumbnails || metadata.youtube_thumbnails.length === 0) {
      return null;
    }

    // Sort by width (largest first) and return the first one
    const sorted = [...metadata.youtube_thumbnails].sort((a, b) => b.width - a.width);
    return sorted[0].url;
  };

  // Format duration from seconds to MM:SS or HH:MM:SS
  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Format view count with K/M suffixes
  const formatViews = (views?: number) => {
    if (!views) return null;

    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    }
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  const thumbnailUrl = getThumbnailUrl();
  const duration = formatDuration(metadata.youtube_duration);
  const views = formatViews(metadata.youtube_views);

  return (
    <div
      className={`
        border border-gray-200 rounded-lg overflow-hidden hover:border-red-300
        transition-all duration-200 cursor-pointer bg-white hover:shadow-md
        ${className}
      `}
      onClick={handleCardClick}
    >
      {/* Thumbnail with Duration Overlay */}
      {thumbnailUrl && (
        <div className="relative aspect-video bg-gray-100 overflow-hidden">
          <img
            src={thumbnailUrl}
            alt={metadata.youtube_title || 'YouTube Video'}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide image on error
              e.currentTarget.style.display = 'none';
            }}
          />

          {/* Duration badge */}
          {duration && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
              {duration}
            </div>
          )}

          {/* YouTube play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-30">
            <div className="bg-red-600 rounded-full p-3 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-3 space-y-1">
        {/* Title */}
        {metadata.youtube_title && (
          <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 hover:underline">
            {metadata.youtube_title}
          </h3>
        )}

        {/* Channel/Author */}
        <div className="flex items-center space-x-1.5 text-xs text-gray-600">
          {/* YouTube icon */}
          <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>

          <span className="truncate">
            {metadata.youtube_author || metadata.youtube_channel_handle || 'YouTube'}
          </span>
        </div>

        {/* Stats: Views */}
        {views && (
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>{views} views</span>
          </div>
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
document.head.appendChild(style);
