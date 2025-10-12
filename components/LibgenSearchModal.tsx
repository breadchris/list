import React, { useState } from 'react';
import { Content } from './ContentRepository';
import { useToast } from './ToastProvider';

interface LibgenSearchModalProps {
  isVisible: boolean;
  selectedContent: Content[];
  onClose: () => void;
  onSearch: (config: LibgenSearchConfig) => void;
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
  onClose,
  onSearch
}) => {
  const [searchType, setSearchType] = useState<'default' | 'title' | 'author'>('default');
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set(['libgen']));
  const [maxResults, setMaxResults] = useState(10);
  const toast = useToast();

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                <span>📚</span>
                <span>Library Genesis Search</span>
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Searching {selectedContent.length} item{selectedContent.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Configuration */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <span>🔍</span>
            <span>Search for Books</span>
          </button>
        </div>
      </div>
    </div>
  );
};
