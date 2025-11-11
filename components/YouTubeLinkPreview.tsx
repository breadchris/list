import React, { useState } from 'react';
import ReactPlayer from 'react-player';
import { extractYouTubeVideoId } from '../utils/youtubeHelpers';

interface YouTubeLinkPreviewProps {
  url: string;
  videoId?: string;
}

/**
 * YouTube Link Preview Component
 *
 * Displays a clickable thumbnail preview for YouTube links in text content.
 * Expands to show inline ReactPlayer when clicked.
 */
export const YouTubeLinkPreview: React.FC<YouTubeLinkPreviewProps> = ({ url, videoId: providedVideoId }) => {
  const [showPlayer, setShowPlayer] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);

  // Extract video ID if not provided
  const videoId = providedVideoId || extractYouTubeVideoId(url);

  // Fallback to regular link if no video ID found
  if (!videoId) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline break-all"
      >
        {url}
      </a>
    );
  }

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  // If showing player, render inline ReactPlayer
  if (showPlayer) {
    return (
      <div className="my-3 border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
          <div className="absolute inset-0">
            <ReactPlayer
              url={url}
              width="100%"
              height="100%"
              controls={true}
              playing={true}
              config={{
                youtube: {
                  playerVars: {
                    showinfo: 0,
                    modestbranding: 1,
                    rel: 0,
                    enablejsapi: 1,
                    origin: typeof window !== 'undefined' ? window.location.origin : '',
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Control bar */}
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-600 hover:text-gray-900 underline truncate flex-1"
            title={url}
          >
            {url}
          </a>
          <button
            onClick={() => setShowPlayer(false)}
            className="ml-3 px-3 py-1 text-xs font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors flex-shrink-0"
            title="Close player"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Default state: Show thumbnail preview
  return (
    <div className="my-3 inline-block max-w-full">
      <div
        onClick={() => setShowPlayer(true)}
        className="relative border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow group"
        style={{ maxWidth: '480px' }}
      >
        {/* Thumbnail */}
        <div className="relative w-full bg-gray-100" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
          {!thumbnailError ? (
            <>
              <img
                src={thumbnailUrl}
                alt="YouTube video thumbnail"
                className="absolute inset-0 w-full h-full object-cover"
                onError={() => setThumbnailError(true)}
                loading="lazy"
              />

              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <svg
                    className="w-7 h-7 text-white ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </>
          ) : (
            // Fallback if thumbnail fails to load
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white">
              <div className="text-center px-4">
                <svg
                  className="w-12 h-12 mx-auto mb-2 text-red-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z" />
                </svg>
                <p className="text-sm">YouTube Video</p>
              </div>
            </div>
          )}
        </div>

        {/* URL footer */}
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600 truncate" title={url}>
            {url}
          </p>
        </div>
      </div>
    </div>
  );
};
