import React, { useState, useEffect, useRef } from 'react';
import { Tag, contentRepository } from './ContentRepository';
import { useDebounce } from '../hooks/useDebounce';
import { useTagMutations } from '../hooks/useTagMutations';
import { useToast } from './ToastProvider';

interface TagSelectorProps {
  contentId: string;
  existingTags: Tag[];
  onSave: () => void;
  onClose: () => void;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  contentId,
  existingTags,
  onSave,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(existingTags.map(tag => tag.id))
  );
  const [isLoading, setIsLoading] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const selectorRef = useRef<HTMLDivElement>(null);
  const { createTag, addTagToContent, removeTagFromContent } = useTagMutations();
  const toast = useToast();

  // Search for tags when debounced search changes
  useEffect(() => {
    const searchTags = async () => {
      if (!debouncedSearch.trim()) {
        setAvailableTags([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await contentRepository.searchTags(debouncedSearch);
        setAvailableTags(results);
      } catch (error) {
        console.error('Error searching tags:', error);
        toast.error('Failed to search tags', 'Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    searchTags();
  }, [debouncedSearch, toast]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const handleCreateNewTag = async () => {
    if (!searchQuery.trim()) return;

    try {
      const newTag = await createTag.mutateAsync({
        name: searchQuery.trim()
      });

      // Auto-select the newly created tag
      setSelectedTagIds(prev => new Set(prev).add(newTag.id));

      // Add to available tags list
      setAvailableTags(prev => [newTag, ...prev]);

      toast.success('Tag created successfully');
      setSearchQuery('');
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error('Failed to create tag', 'Please try again.');
    }
  };

  const handleSave = async () => {
    try {
      const existingTagIds = new Set(existingTags.map(tag => tag.id));

      // Find tags to add (in selectedTagIds but not in existingTagIds)
      const tagsToAdd = Array.from(selectedTagIds).filter(id => !existingTagIds.has(id));

      // Find tags to remove (in existingTagIds but not in selectedTagIds)
      const tagsToRemove = Array.from(existingTagIds).filter(id => !selectedTagIds.has(id));

      // Execute all additions
      for (const tagId of tagsToAdd) {
        await addTagToContent.mutateAsync({ contentId, tagId });
      }

      // Execute all removals
      for (const tagId of tagsToRemove) {
        await removeTagFromContent.mutateAsync({ contentId, tagId });
      }

      if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
        toast.success('Tags updated successfully');
      }

      onSave();
    } catch (error) {
      console.error('Error saving tags:', error);
      toast.error('Failed to save tags', 'Please try again.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // If there's an exact match, toggle it
      const exactMatch = availableTags.find(
        tag => tag.name.toLowerCase() === searchQuery.toLowerCase().trim()
      );

      if (exactMatch) {
        toggleTag(exactMatch.id);
        setSearchQuery('');
      } else if (searchQuery.trim()) {
        // Otherwise create a new tag
        handleCreateNewTag();
      }
    }
  };

  const hasExactMatch = availableTags.some(
    tag => tag.name.toLowerCase() === searchQuery.toLowerCase().trim()
  );

  return (
    <div
      ref={selectorRef}
      className="absolute top-12 right-0 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50"
      onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder="Search or create tag..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>

      {/* Tag List */}
      <div className="max-h-60 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <div className="flex items-center justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full mr-2"></div>
              Searching...
            </div>
          </div>
        ) : availableTags.length > 0 ? (
          <div className="py-2">
            {availableTags.map(tag => (
              <label
                key={tag.id}
                className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTagIds.has(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span
                  className="inline-block px-2 py-1 text-xs rounded-full text-gray-600 bg-gray-100 border"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}20` : undefined,
                    borderColor: tag.color || undefined
                  }}
                >
                  {tag.name}
                </span>
              </label>
            ))}
          </div>
        ) : searchQuery.trim() ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No matching tags found
          </div>
        ) : (
          <div className="p-4 text-center text-gray-400 text-sm">
            Start typing to search tags
          </div>
        )}

        {/* Create New Tag Option */}
        {searchQuery.trim() && !hasExactMatch && (
          <div className="border-t border-gray-200">
            <button
              onClick={handleCreateNewTag}
              className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create new tag "{searchQuery.trim()}"
            </button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-gray-200 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Save
        </button>
      </div>
    </div>
  );
};
