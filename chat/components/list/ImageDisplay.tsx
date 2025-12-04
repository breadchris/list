import React, { useState } from 'react';

interface ImageDisplayProps {
  imageUrl: string;
  alt?: string;
  className?: string;
}

/**
 * Component to display uploaded images with reasonable max-height
 * Features:
 * - Max height of 400px to prevent overly tall images
 * - Responsive width (full width of container)
 * - Maintains aspect ratio
 * - Click to view full size in new tab
 * - Loading state with skeleton
 * - Error handling with fallback UI
 * - Memoized to prevent unnecessary rerenders when parent updates
 */
const ImageDisplayComponent: React.FC<ImageDisplayProps> = ({
  imageUrl,
  alt = 'Uploaded image',
  className = ''
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleImageError = () => {
    setLoading(false);
    setError(true);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(imageUrl, '_blank');
  };

  if (error) {
    return (
      <div className={`rounded-lg border border-gray-200 overflow-hidden bg-gray-50 ${className}`}>
        <div className="flex flex-col items-center justify-center p-8 text-gray-400">
          <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">Failed to load image</p>
          <button
            onClick={handleClick}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Try opening in new tab
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-gray-200 overflow-hidden bg-gray-50 ${className}`}>
      {/* Loading skeleton */}
      {loading && (
        <div className="w-full h-64 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="text-gray-400">
            <svg className="w-12 h-12 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      )}

      {/* Image with max-height constraint */}
      <img
        src={imageUrl}
        alt={alt}
        onLoad={handleImageLoad}
        onError={handleImageError}
        onClick={handleClick}
        className={`
          w-full
          max-h-96
          object-contain
          cursor-pointer
          hover:opacity-95
          transition-opacity
          ${loading ? 'hidden' : 'block'}
        `}
        loading="lazy"
      />

      {/* Image info footer */}
      {!loading && !error && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-gray-500">Image</span>
            </div>
            <button
              onClick={handleClick}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>View full size</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Memoize to prevent rerenders when parent updates but props haven't changed
export const ImageDisplay = React.memo(ImageDisplayComponent);
