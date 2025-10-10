import React, { useState, useEffect } from 'react';
import { Content } from './ContentRepository';
import { useTMDbSearch, useTMDbAddResults, TMDbResult } from '../hooks/useTMDbSearch';
import { useToast } from './ToastProvider';

interface TMDbSearchModalProps {
  isVisible: boolean;
  selectedContent: Content;
  searchType?: 'movie' | 'tv' | 'multi';
  onClose: () => void;
  onResultsAdded: () => void;
}

export const TMDbSearchModal: React.FC<TMDbSearchModalProps> = ({
  isVisible,
  selectedContent,
  searchType = 'multi',
  onClose,
  onResultsAdded
}) => {
  const [searchResults, setSearchResults] = useState<TMDbResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const toast = useToast();

  const searchMutation = useTMDbSearch();
  const addResultsMutation = useTMDbAddResults();

  // Auto-search when modal becomes visible
  useEffect(() => {
    if (isVisible && selectedContent) {
      setSearchResults([]);
      setSelectedResults(new Set());

      searchMutation.mutate({
        contentId: selectedContent.id,
        searchType
      }, {
        onSuccess: (data) => {
          setSearchResults(data.results);
          if (data.results.length === 0) {
            toast.info('No Results', 'No movies or TV shows found for this search');
          }
        },
        onError: (error) => {
          toast.error('Search Failed', error instanceof Error ? error.message : 'Unknown error');
        }
      });
    }
  }, [isVisible, selectedContent?.id]);

  const toggleResult = (tmdbId: number) => {
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(tmdbId)) {
        next.delete(tmdbId);
      } else {
        next.add(tmdbId);
      }
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (selectedResults.size === 0) {
      toast.error('No Selection', 'Please select at least one movie or TV show');
      return;
    }

    addResultsMutation.mutate({
      contentId: selectedContent.id,
      tmdbIds: Array.from(selectedResults),
      searchType
    }, {
      onSuccess: (data) => {
        toast.success(
          'Content Added!',
          `Successfully added ${data.results_created} item${data.results_created !== 1 ? 's' : ''}`
        );
        onResultsAdded();
        onClose();
      },
      onError: (error) => {
        toast.error('Add Failed', error instanceof Error ? error.message : 'Unknown error');
      }
    });
  };

  if (!isVisible) return null;

  const isLoading = searchMutation.isPending;
  const isAdding = addResultsMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                <span>🎬</span>
                <span>TMDb Search Results</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isLoading ? 'Searching...' : `${searchResults.length} results found`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isAdding}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Results Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-600">Searching TMDb...</p>
            </div>
          )}

          {!isLoading && searchResults.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">🔍</div>
              <p>No results found</p>
            </div>
          )}

          {!isLoading && searchResults.length > 0 && (
            <div className="space-y-3">
              {searchResults.map((result) => {
                const isSelected = selectedResults.has(result.tmdb_id);

                return (
                  <div
                    key={result.tmdb_id}
                    onClick={() => toggleResult(result.tmdb_id)}
                    className={`cursor-pointer rounded-lg border-2 transition-all p-3 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex gap-4">
                      {/* Poster Thumbnail */}
                      <div className="flex-shrink-0 relative w-24 h-36 rounded overflow-hidden bg-gray-100">
                        {result.poster_url ? (
                          <img
                            src={result.poster_url}
                            alt={result.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                            </svg>
                          </div>
                        )}

                        {/* Selection Checkbox */}
                        <div className="absolute top-2 right-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            isSelected
                              ? 'bg-blue-500'
                              : 'bg-white bg-opacity-90'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1">
                            <h3 className="font-semibold text-base text-gray-900 mb-1">
                              {result.title}
                            </h3>
                            {result.year && (
                              <p className="text-sm text-gray-600">
                                {result.year}
                              </p>
                            )}
                          </div>
                          <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                            {result.media_type === 'movie' ? '🎬 Movie' : '📺 TV'}
                          </span>
                        </div>

                        <p className="text-sm text-gray-700 line-clamp-3 mb-2">
                          {result.overview}
                        </p>

                        {result.vote_average > 0 && (
                          <div className="flex items-center text-sm text-gray-600">
                            <span className="mr-1">⭐</span>
                            <span className="font-medium">{result.vote_average.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {selectedResults.size > 0 ? (
                <span className="font-medium text-blue-600">
                  {selectedResults.size} selected
                </span>
              ) : (
                <span>Select movies or TV shows to add</span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                disabled={isAdding}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSelected}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedResults.size === 0 || isAdding
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                disabled={selectedResults.size === 0 || isAdding}
              >
                {isAdding ? (
                  <span className="flex items-center">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Adding...
                  </span>
                ) : (
                  `Add Selected (${selectedResults.size})`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
