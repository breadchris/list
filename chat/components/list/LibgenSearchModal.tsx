import React, { useState, useEffect } from 'react';
import { Content } from '@/lib/list/ContentRepository';
import { useToast } from './ToastProvider';
import { LibgenSearchResult, LibgenBook } from '@/hooks/list/useLibgenSearch';

interface LibgenSearchModalProps {
  isVisible: boolean;
  selectedContent: Content[];
  searchResults?: LibgenSearchResult[];
  isSearching?: boolean;
  onClose: () => void;
  onSearch: (config: LibgenSearchConfig) => void;
  onAddSelected?: (books: Content[]) => Promise<void>; // Callback to create selected books as Content items
}

export interface LibgenSearchConfig {
  searchType: 'default' | 'title' | 'author';
  topics: string[];
  maxResults: number;
}

const AVAILABLE_TOPICS = [
  { value: 'libgen', label: 'Library Genesis', description: 'General library' },
  { value: 'fiction', label: 'Fiction', description: 'Novels and fiction' },
  { value: 'comics', label: 'Comics', description: 'Comics and graphic novels' },
  { value: 'articles', label: 'Articles', description: 'Scientific articles' },
  { value: 'magazines', label: 'Magazines', description: 'Magazines and periodicals' },
  { value: 'standards', label: 'Standards', description: 'Technical standards' }
];

export const LibgenSearchModal: React.FC<LibgenSearchModalProps> = ({
  isVisible,
  selectedContent,
  searchResults = [],
  isSearching = false,
  onClose,
  onSearch,
  onAddSelected
}) => {
  const [searchType, setSearchType] = useState<'default' | 'title' | 'author'>('default');
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set(['libgen']));
  const [maxResults, setMaxResults] = useState(10);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [booksPerPage, setBooksPerPage] = useState(10);
  const toast = useToast();

  // Helper function to extract title from book data
  const extractTitle = (book: Content): string => {
    // Try to extract title from data field (formatted as "📚 Title\n...")
    const dataMatch = book.data.match(/📚\s*(.+?)(?:\n|$)/);
    if (dataMatch) {
      return dataMatch[1].trim();
    }
    // Fallback to metadata
    return book.metadata?.libgen?.title || 'Untitled';
  };

  // Reset state when modal is closed
  useEffect(() => {
    if (!isVisible) {
      setShowAdvancedOptions(false);
      setSelectedBooks(new Set());
      setCurrentPage(1);
    }
  }, [isVisible]);

  // Reset to page 1 when search results change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchResults]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topic)) {
        // Keep at least one topic selected
        if (next.size > 1) {
          next.delete(topic);
        } else {
          toast.warning('At Least One Topic', 'Please keep at least one topic selected');
        }
      } else {
        next.add(topic);
      }
      return next;
    });
  };

  const handleSearch = () => {
    onSearch({
      searchType,
      topics: Array.from(selectedTopics),
      maxResults
    });
  };

  if (!isVisible) return null;

  const hasResults = searchResults.length > 0;
  const allBooks = searchResults.flatMap(result => result.book_children || []);
  const totalBooksFound = searchResults.reduce((sum, result) => sum + result.books_found, 0);
  const totalBooksCreated = searchResults.reduce((sum, result) => sum + result.books_created, 0);

  // Pagination calculations
  const totalPages = Math.ceil(allBooks.length / booksPerPage);
  const startIndex = (currentPage - 1) * booksPerPage;
  const endIndex = startIndex + booksPerPage;
  const currentBooks = allBooks.slice(startIndex, endIndex);

  // Selection handlers (defined after allBooks)
  const toggleBookSelection = (bookId: string) => {
    setSelectedBooks(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  };

  const selectAllBooks = () => {
    setSelectedBooks(new Set(allBooks.map(book => book.id)));
  };

  const deselectAllBooks = () => {
    setSelectedBooks(new Set());
  };

  const handleAddSelectedBooks = async () => {
    if (!onAddSelected || selectedBooks.size === 0) return;

    try {
      setIsAdding(true);
      const booksToAdd = allBooks.filter(book => selectedBooks.has(book.id));
      await onAddSelected(booksToAdd);

      toast.success(
        'Books Added!',
        `Added ${booksToAdd.length} book${booksToAdd.length !== 1 ? 's' : ''} to your list`
      );

      onClose(); // Close modal after successful add
    } catch (error) {
      console.error('Failed to add selected books:', error);
      toast.error(
        'Failed to Add Books',
        'An error occurred while adding the selected books'
      );
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                <span>📚</span>
                <span>Library Genesis Search</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isSearching
                  ? 'Searching...'
                  : hasResults
                    ? `${selectedBooks.size} of ${totalBooksFound} books selected`
                    : `Searching ${selectedContent.length} item${selectedContent.length !== 1 ? 's' : ''}`
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSearching}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Loading State */}
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin h-12 w-12 border-4 border-green-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-600">Searching Libgen...</p>
            </div>
          )}

          {/* Results Display */}
          {!isSearching && hasResults && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Books Found</h3>
                <span className="text-sm text-gray-600">
                  {totalBooksFound} book{totalBooksFound !== 1 ? 's' : ''} found
                </span>
              </div>

              {allBooks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-4">📖</div>
                  <p>No books found matching your search</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Selection and Pagination Controls */}
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">
                        {selectedBooks.size} of {allBooks.length} selected
                      </span>
                      <div className="space-x-2">
                        <button
                          onClick={selectAllBooks}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          Select All
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={deselectAllBooks}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {/* Per Page Selector */}
                    <div className="flex items-center space-x-2">
                      <label className="text-xs text-gray-600">Show:</label>
                      <select
                        value={booksPerPage}
                        onChange={(e) => setBooksPerPage(Number(e.target.value))}
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={allBooks.length}>All ({allBooks.length})</option>
                      </select>
                    </div>
                  </div>

                  {currentBooks.map((book, index) => {
                    const libgenMeta = book.metadata?.libgen || {};
                    const isSelected = selectedBooks.has(book.id);

                    return (
                      <div
                        key={`${book.id}-${index}`}
                        className={`border-2 rounded-lg p-4 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => toggleBookSelection(book.id)}
                      >
                        <div className="flex items-start space-x-3">
                          {/* Checkbox */}
                          <div className="flex-shrink-0 mt-1">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-gray-300 bg-white'
                            }`}>
                              {isSelected && (
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Book Info */}
                          <div className="flex-1 space-y-2">
                            <h4 className="font-semibold text-gray-900">
                              {extractTitle(book)}
                            </h4>
                            {libgenMeta.author && (
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Author:</span> {libgenMeta.author}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                              {libgenMeta.year && (
                                <span className="px-2 py-1 bg-gray-100 rounded">
                                  {libgenMeta.year}
                                </span>
                              )}
                              {libgenMeta.publisher && (
                                <span className="px-2 py-1 bg-gray-100 rounded">
                                  {libgenMeta.publisher}
                                </span>
                              )}
                              {libgenMeta.language && (
                                <span className="px-2 py-1 bg-gray-100 rounded">
                                  {libgenMeta.language}
                                </span>
                              )}
                              {libgenMeta.pages && (
                                <span className="px-2 py-1 bg-gray-100 rounded">
                                  {libgenMeta.pages} pages
                                </span>
                              )}
                              {libgenMeta.extension && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                  {libgenMeta.extension.toUpperCase()}
                                </span>
                              )}
                              {libgenMeta.size && (
                                <span className="px-2 py-1 bg-gray-100 rounded">
                                  {libgenMeta.size}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className={`px-3 py-1 text-sm rounded transition-colors ${
                          currentPage === 1
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-blue-600 hover:bg-blue-50'
                        }`}
                      >
                        ← Previous
                      </button>

                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                          Page {currentPage} of {totalPages}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({startIndex + 1}-{Math.min(endIndex, allBooks.length)} of {allBooks.length})
                        </span>
                      </div>

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1 text-sm rounded transition-colors ${
                          currentPage === totalPages
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-blue-600 hover:bg-blue-50'
                        }`}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Search Configuration (shown when no results) */}
          {!isSearching && !hasResults && (
            <div className="space-y-6">
              {/* Simple Search View */}
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📚</div>
                <p className="text-gray-600 mb-6">
                  Search for books using the selected content as queries
                </p>
                <button
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center justify-center mx-auto space-x-1"
                >
                  <span>{showAdvancedOptions ? '▼' : '▶'}</span>
                  <span>{showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options</span>
                </button>
              </div>

              {/* Advanced Options */}
              {showAdvancedOptions && (
                <div className="space-y-6 pt-4 border-t border-gray-200">
                  {/* Search Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Type
                    </label>
                    <div className="space-y-2">
                      {[
                        { value: 'default', label: 'Default', description: 'Search across all fields' },
                        { value: 'title', label: 'Title', description: 'Search book titles only' },
                        { value: 'author', label: 'Author', description: 'Search authors only' }
                      ].map((type) => (
                        <label
                          key={type.value}
                          className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            searchType === type.value
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="searchType"
                            value={type.value}
                            checked={searchType === type.value}
                            onChange={(e) => setSearchType(e.target.value as any)}
                            className="mt-1 mr-3"
                          />
                          <div>
                            <div className="font-medium text-gray-900">{type.label}</div>
                            <div className="text-sm text-gray-500">{type.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Topics */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Topics to Search
                    </label>
                    <div className="space-y-2">
                      {AVAILABLE_TOPICS.map((topic) => {
                        const isSelected = selectedTopics.has(topic.value);
                        return (
                          <label
                            key={topic.value}
                            className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              isSelected
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTopic(topic.value)}
                              className="mt-1 mr-3"
                            />
                            <div>
                              <div className="font-medium text-gray-900">{topic.label}</div>
                              <div className="text-sm text-gray-500">{topic.description}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Max Results */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Results per Item
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="range"
                        min="1"
                        max="50"
                        value={maxResults}
                        onChange={(e) => setMaxResults(parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-lg font-medium text-gray-900 w-12 text-right">
                        {maxResults}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Each selected item will search for up to {maxResults} books
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            disabled={isSearching || isAdding}
          >
            {hasResults ? 'Cancel' : 'Cancel'}
          </button>
          {!hasResults ? (
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className={`px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 ${
                isSearching ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <span>🔍</span>
              <span>Search for Books</span>
            </button>
          ) : (
            <button
              onClick={handleAddSelectedBooks}
              disabled={selectedBooks.size === 0 || isAdding}
              className={`px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 ${
                (selectedBooks.size === 0 || isAdding) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isAdding ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <span>📚</span>
                  <span>Add {selectedBooks.size} Selected Book{selectedBooks.size !== 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
