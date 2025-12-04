import React, { useState } from 'react';
import { Content } from '@/lib/list/ContentRepository';
import { MarkdownProgressItem } from '@/hooks/list/useMarkdownExtraction';

interface MarkdownProgressOverlayProps {
  isVisible: boolean;
  selectedContent: Content[];
  progressItems: MarkdownProgressItem[];
  onClose: () => void;
}

export const MarkdownProgressOverlay: React.FC<MarkdownProgressOverlayProps> = ({
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
  const totalUrlsFound = progressItems.reduce((sum, item) => sum + item.urlsFound, 0);
  const totalUrlsProcessed = progressItems.reduce((sum, item) => sum + item.urlsProcessed, 0);

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

  const getStatusIcon = (status: MarkdownProgressItem['status']) => {
    switch (status) {
      case 'pending':
        return <span className="text-gray-400">⏳</span>;
      case 'processing':
        return (
          <div className="inline-block">
            <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
          </div>
        );
      case 'completed':
        return <span className="text-green-500">✅</span>;
      case 'failed':
        return <span className="text-red-500">❌</span>;
    }
  };

  const getStatusText = (status: MarkdownProgressItem['status']) => {
    switch (status) {
      case 'pending':
        return 'Waiting...';
      case 'processing':
        return 'Converting to markdown...';
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
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                📝 Markdown Extraction Progress
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Processing {totalItems} item{totalItems !== 1 ? 's' : ''} • {totalUrlsProcessed}/{totalUrlsFound} URLs converted
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
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {progressItems.map((item) => {
            const isExpanded = expandedItems.has(item.contentId);
            const truncatedText = item.content.data.length > 100
              ? item.content.data.substring(0, 100) + '...'
              : item.content.data;

            return (
              <div
                key={item.contentId}
                className={`border rounded-lg p-4 transition-all ${
                  item.status === 'processing' ? 'border-purple-300 bg-purple-50' :
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
                          {item.urlsFound > 0 && (
                            <span className="ml-2">
                              • {item.urlsProcessed}/{item.urlsFound} URLs processed
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

                    {/* Markdown Children Preview */}
                    {item.markdownChildren.length > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleExpanded(item.contentId)}
                          className="flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-700"
                        >
                          <svg
                            className={`w-3 h-3 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span>
                            {isExpanded ? 'Hide' : 'Show'} {item.markdownChildren.length} markdown document{item.markdownChildren.length !== 1 ? 's' : ''}
                          </span>
                        </button>

                        {/* Expanded Markdown Preview */}
                        {isExpanded && (
                          <div className="mt-3 space-y-2 pl-4 border-l-2 border-purple-200">
                            {item.markdownChildren.map((mdChild: any) => (
                              <div key={mdChild.id} className="bg-white border border-gray-200 rounded-lg p-3">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="text-xs font-medium text-purple-600">📄 Markdown</span>
                                  {mdChild.metadata?.source_url && (
                                    <a
                                      href={mdChild.metadata.source_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline truncate max-w-xs"
                                    >
                                      {mdChild.metadata.source_url}
                                    </a>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                                  {mdChild.data.length > 200
                                    ? mdChild.data.substring(0, 200) + '...'
                                    : mdChild.data}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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
                <p>Preparing to convert URLs to markdown...</p>
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
                  ✨ Conversion complete!
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
                  : 'bg-purple-600 text-white hover:bg-purple-700'
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
