import React, { useState, useRef, useEffect } from 'react';
import { Tag, contentRepository } from './ContentRepository';
import { useDebounce } from '../hooks/useDebounce';

interface TagFilterSelectorProps {
  selectedTags: Tag[];
  groupId: string;
  onTagAdd: (tag: Tag) => void;
  onTagRemove: (tagId: string) => void;
  onClearAll: () => void;
}

export const TagFilterSelector: React.FC<TagFilterSelectorProps> = ({
  selectedTags,
  groupId,
  onTagAdd,
  onTagRemove,
  onClearAll
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Search for tags when debounced search changes
  useEffect(() => {
    const searchTags = async () => {
      if (!debouncedSearch.trim() || !groupId) {
        setAvailableTags([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await contentRepository.searchTags(debouncedSearch);
        // Filter out already selected tags
        const filteredResults = results.filter(
          (tag: Tag) => !selectedTags.some((st: Tag) => st.id === tag.id)
        );
        setAvailableTags(filteredResults);
      } catch (error) {
        console.error('Error searching tags:', error);
        setAvailableTags([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchTags();
  }, [debouncedSearch, groupId, selectedTags]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleTagSelect = (tag: Tag) => {
    onTagAdd(tag);
    setSearchQuery('');
    setAvailableTags([]);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && availableTags.length > 0) {
      e.preventDefault();
      handleTagSelect(availableTags[0]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery('');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Filter by Tag Button */}
      <button
        onClick={toggleOpen}
        className={`flex items-center space-x-1 px-2 py-1 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          selectedTags.length > 0
            ? 'text-blue-700 bg-blue-50 hover:bg-blue-100'
            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
        }`}
        title="Filter by tag"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
          />
        </svg>
        {selectedTags.length > 0 && (
          <span className="text-xs font-semibold">{selectedTags.length}</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search tags..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Search Results */}
          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center">
                <div className="animate-spin h-6 w-6 border-2 border-gray-400 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : availableTags.length > 0 ? (
              <div className="py-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagSelect(tag)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                  >
                    {tag.color && (
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      ></span>
                    )}
                    <span className="text-sm font-medium text-gray-700 truncate">{tag.name}</span>
                  </button>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No tags found
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                Start typing to search tags
              </div>
            )}
          </div>

          {/* Clear All Button (only show if tags are selected) */}
          {selectedTags.length > 0 && (
            <div className="p-3 border-t border-gray-200">
              <button
                onClick={() => {
                  onClearAll();
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className="w-full px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
