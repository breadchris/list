import React, { useState, useRef, useEffect } from "react";
import { Tag, TagFilter, contentRepository } from "./ContentRepository";
import { useDebounce } from "../hooks/useDebounce";
import { useCreateContentMutation, useInfiniteContentByParent } from "../hooks/useContentQueries";
import { useToast } from "./ToastProvider";

interface TagFilterSelectorProps {
  selectedTags: TagFilter[];
  availableTags: Tag[];
  groupId: string;
  onTagAdd: (tag: Tag, mode: "include" | "exclude") => void;
  onTagRemove: (tagId: string) => void;
  onClearAll: () => void;
}

export const TagFilterSelector: React.FC<TagFilterSelectorProps> = ({
  selectedTags,
  availableTags,
  groupId,
  onTagAdd,
  onTagRemove,
  onClearAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [filterName, setFilterName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const createContentMutation = useCreateContentMutation();
  const toast = useToast();

  // Fetch saved tag filters for this group
  const {
    data: savedFiltersData,
    isLoading: savedFiltersLoading,
  } = useInfiniteContentByParent(
    groupId,
    null,
    { viewMode: 'chronological' }
  );

  // Extract saved tag-filter content items
  const savedFilters = React.useMemo(() => {
    if (!savedFiltersData) return [];
    const allContent = savedFiltersData.pages.flatMap(page => page.items);
    return allContent.filter(content => content.type === 'tag-filter');
  }, [savedFiltersData]);

  const [selectedMode, setSelectedMode] = useState<"include" | "exclude">(
    "include",
  );

  // Filter available tags locally based on search query
  const filteredTags = React.useMemo(() => {
    // Filter out already selected tags
    const unselectedTags = availableTags.filter(
      (tag: Tag) => !selectedTags.some((tf: TagFilter) => tf.tag.id === tag.id),
    );

    // If no search query, return all unselected tags
    if (!searchQuery.trim()) {
      return unselectedTags;
    }

    // Filter by search query (case-insensitive)
    const query = searchQuery.toLowerCase();
    return unselectedTags.filter((tag: Tag) =>
      tag.name.toLowerCase().includes(query),
    );
  }, [availableTags, selectedTags, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleTagSelect = (tag: Tag, mode?: "include" | "exclude") => {
    onTagAdd(tag, mode || selectedMode);
    setSearchQuery("");
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredTags.length > 0) {
      e.preventDefault();
      handleTagSelect(filteredTags[0]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery("");
    }
  };

  const handleSaveFilter = async () => {
    if (!filterName.trim() || selectedTags.length === 0) {
      toast.error(
        "Invalid Filter",
        "Please enter a filter name and select at least one tag",
      );
      return;
    }

    try {
      await createContentMutation.mutateAsync({
        type: "tag-filter",
        data: filterName.trim(),
        group_id: groupId,
        parent_content_id: null,
        metadata: {
          filter_name: filterName.trim(),
          tag_ids: selectedTags.map((t) => t.id),
          tag_names: selectedTags.map((t) => t.name),
          tag_colors: selectedTags.map((t) => t.color || null),
        },
      });

      toast.success("Filter Saved", `"${filterName.trim()}" has been saved`);
      setIsSaving(false);
      setFilterName("");
    } catch (error) {
      console.error("Error saving filter:", error);
      toast.error("Save Failed", "Failed to save tag filter");
    }
  };

  const handleSaveKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveFilter();
    } else if (e.key === "Escape") {
      setIsSaving(false);
      setFilterName("");
    }
  };

  // Focus save input when saving mode activates
  useEffect(() => {
    if (isSaving && saveInputRef.current) {
      saveInputRef.current.focus();
    }
  }, [isSaving]);

  // Check if a saved filter is currently active
  const isFilterActive = (filterMetadata: any) => {
    if (!filterMetadata?.tag_ids || !Array.isArray(filterMetadata.tag_ids)) {
      return false;
    }

    const filterTagIds = new Set(filterMetadata.tag_ids);
    const currentTagIds = new Set(selectedTags.map(t => t.tag.id));

    if (filterTagIds.size !== currentTagIds.size) {
      return false;
    }

    return Array.from(filterTagIds).every(id => currentTagIds.has(id));
  };

  // Apply a saved filter
  const applySavedFilter = (filterContent: any) => {
    if (!filterContent.metadata?.tag_ids || !filterContent.metadata?.tag_names) {
      return;
    }

    const tags: Tag[] = filterContent.metadata.tag_ids.map((id: string, index: number) => ({
      id,
      name: filterContent.metadata.tag_names[index],
      created_at: '',
      user_id: '',
      color: filterContent.metadata.tag_colors?.[index]
    }));

    // Clear existing filters and add all tags from saved filter
    onClearAll();
    tags.forEach(tag => onTagAdd(tag, 'include'));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Filter by Tag Button */}
      <button
        onClick={toggleOpen}
        className={`flex items-center space-x-1 px-2 py-1 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          selectedTags.length > 0
            ? "text-blue-700 bg-blue-50 hover:bg-blue-100"
            : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
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
        <div className="absolute top-full left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Mode Selector */}
          <div className="p-3 border-b border-gray-200">
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setSelectedMode("include")}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedMode === "include"
                    ? "bg-green-100 text-green-800 border border-green-300"
                    : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                }`}
              >
                + Include
              </button>
              <button
                onClick={() => setSelectedMode("exclude")}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedMode === "exclude"
                    ? "bg-red-100 text-red-800 border border-red-300"
                    : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                }`}
              >
                − Exclude
              </button>
            </div>
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

          {/* Selected Tags Display (Mobile Only) */}
          {selectedTags.length > 0 && (
            <div className="md:hidden p-3 border-b border-gray-200 bg-gray-50">
              <div className="text-xs font-semibold text-gray-600 mb-2">Selected Filters</div>
              <div className="flex flex-wrap gap-1">
                {selectedTags.map((tagFilter) => (
                  <div key={tagFilter.tag.id} className="flex items-center gap-0.5">
                    <span
                      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-l-full ${
                        tagFilter.mode === 'include'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      <span className="text-[10px] font-bold">{tagFilter.mode === 'include' ? '+' : '−'}</span>
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTagRemove(tagFilter.tag.id);
                      }}
                      className="inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-r-full transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: tagFilter.tag.color ? `${tagFilter.tag.color}20` : '#e5e7eb',
                        borderColor: tagFilter.tag.color || '#d1d5db',
                        borderWidth: '1px',
                        color: tagFilter.tag.color || '#374151'
                      }}
                      title={`Remove ${tagFilter.tag.name} filter`}
                    >
                      <span>{tagFilter.tag.name}</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved Filters Section (Mobile Only) */}
          {savedFilters.length > 0 && (
            <div className="md:hidden p-3 border-b border-gray-200">
              <div className="text-xs font-semibold text-gray-600 mb-2">Saved Filters</div>
              <div className="flex flex-wrap gap-2">
                {savedFilters.map(filter => {
                  const isActive = isFilterActive(filter.metadata);
                  const filterName = filter.data || filter.metadata?.filter_name || 'Unnamed Filter';

                  return (
                    <button
                      key={filter.id}
                      onClick={() => applySavedFilter(filter)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title={`Apply filter: ${filterName}`}
                    >
                      <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                      {filterName}
                      {filter.metadata?.tag_ids && (
                        <span className="ml-1.5 opacity-75">({filter.metadata.tag_ids.length})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Results */}
          <div className="max-h-60 overflow-y-auto">
            {filteredTags.length > 0 ? (
              <div className="py-2">
                {filteredTags.map((tag) => (
                  <div key={tag.id} className="px-2">
                    <div className="flex items-center gap-1 hover:bg-gray-50 rounded-md transition-colors">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTagSelect(tag, "include");
                        }}
                        className="p-2 hover:bg-green-100 rounded-l-md transition-colors"
                        title="Include this tag"
                      >
                        <span className="text-green-700 text-xs font-bold">
                          +
                        </span>
                      </button>
                      <button
                        onClick={() => handleTagSelect(tag)}
                        className="flex-1 text-left px-2 py-2 flex items-center space-x-2"
                      >
                        {tag.color && (
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color }}
                          ></span>
                        )}
                        <span className="text-sm font-medium text-gray-700 truncate">
                          {tag.name}
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTagSelect(tag, "exclude");
                        }}
                        className="p-2 hover:bg-red-100 rounded-r-md transition-colors"
                        title="Exclude this tag"
                      >
                        <span className="text-red-700 text-xs font-bold">
                          −
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No tags found matching "{searchQuery}"
              </div>
            ) : availableTags.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No tags available in this group
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                All tags are already selected
              </div>
            )}
          </div>

          {/* Save Filter and Clear All Buttons (only show if tags are selected) */}
          {selectedTags.length > 0 && (
            <div className="p-3 border-t border-gray-200 space-y-2">
              {/* Save Filter Section */}
              {isSaving ? (
                <div className="space-y-2">
                  <input
                    ref={saveInputRef}
                    type="text"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    onKeyDown={handleSaveKeyDown}
                    placeholder="Enter filter name..."
                    className="w-full px-3 py-2 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveFilter}
                      disabled={createContentMutation.isPending}
                      className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createContentMutation.isPending ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setIsSaving(false);
                        setFilterName("");
                      }}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsSaving(true)}
                  className="w-full px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors flex items-center justify-center"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                  Save current filter
                </button>
              )}

              {/* Clear All Button */}
              <button
                onClick={() => {
                  onClearAll();
                  setIsOpen(false);
                  setSearchQuery("");
                }}
                className="w-full px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center justify-center"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
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
