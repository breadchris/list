import React, { useState } from 'react';
import { Content } from '@/lib/list/ContentRepository';
import { YouTubeProgressItem } from '@/hooks/list/useYouTubePlaylistExtraction';

interface YouTubeProgressOverlayProps {
  isVisible: boolean;
  selectedContent: Content[];
  progressItems: YouTubeProgressItem[];
  onClose: () => void;
}

export const YouTubeProgressOverlay: React.FC<YouTubeProgressOverlayProps> = ({
  isVisible,
  selectedContent,
  progressItems,
  onClose
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Calculate overall progress
  const totalItems = progressItems.length;
  const completedItems = progressItems.filter(item =>
    item.status === 'completed' || item.status === 'failed'
  ).length;
  const failedItems = progressItems.filter(item => item.status === 'failed').length;
  const totalPlaylistsFound = progressItems.reduce((sum, item) => sum + item.playlistsFound, 0);
  const totalVideosCreated = progressItems.reduce((sum, item) => sum + item.videosCreated, 0);

  const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  const toggleExpanded = (contentId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(contentId)) {
        next.delete(contentId);
      } else {
        next.add(contentId);
      }
      return next;
    });
  };

  const getStatusIcon = (status: YouTubeProgressItem['status']) => {
    switch (status) {
      case 'processing':
        return (
          <div className="inline-block">
            <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></div>
          </div>
        );
      case 'completed':
        return <span className="text-green-500">✅</span>;
      case 'failed':
        return <span className="text-red-500">❌</span>;
    }
  };

  const getStatusText = (status: YouTubeProgressItem['status']) => {
    switch (status) {
      case 'processing':
        return 'Extracting playlist...';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                <span>🎬</span>
                <span>YouTube Playlist Extraction</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Processing {totalItems} item{totalItems !== 1 ? 's' : ''} • {totalVideosCreated} video{totalVideosCreated !== 1 ? 's' : ''} extracted from {totalPlaylistsFound} playlist{totalPlaylistsFound !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={progressItems.some(item => item.status === 'processing')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{completedItems} of {totalItems} completed</span>
              {failedItems > 0 && (
                <span className="text-red-600">{failedItems} failed</span>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {progressItems.map((item) => {
            const truncatedText = item.content.data.length > 100
              ? item.content.data.substring(0, 100) + '...'
              : item.content.data;

            return (
              <div
                key={item.contentId}
                className={`border rounded-lg p-4 transition-all ${
                  item.status === 'processing' ? 'border-red-300 bg-red-50' :
                  item.status === 'completed' ? 'border-green-200 bg-green-50' :
                  item.status === 'failed' ? 'border-red-200 bg-red-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                {/* Item Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <div className="flex-shrink-0">
                        {getStatusIcon(item.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">
                          {truncatedText}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {getStatusText(item.status)}
                          {item.playlistsFound > 0 && (
                            <span className="ml-2">
                              • {item.playlistsFound} playlist{item.playlistsFound !== 1 ? 's' : ''} found
                            </span>
                          )}
                          {item.videosCreated > 0 && (
                            <span className="ml-2">
                              • {item.videosCreated} video{item.videosCreated !== 1 ? 's' : ''} created
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Error Message */}
                    {item.error && (
                      <div className="mt-2 text-xs text-red-600 bg-red-100 rounded p-2">
                        {item.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {progressItems.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-pulse">
                <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4"></div>
                <p>Preparing to extract YouTube playlists...</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {progressItems.every(item => item.status === 'completed' || item.status === 'failed') ? (
                <span className="text-green-600 font-medium">
                  ✨ Extraction complete!
                </span>
              ) : (
                <span>
                  Processing in progress...
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-lg transition-colors ${
                progressItems.some(item => item.status === 'processing')
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
              disabled={progressItems.some(item => item.status === 'processing')}
            >
              {progressItems.some(item => item.status === 'processing') ? 'Processing...' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
