import React from 'react';
import { Tag } from './ContentRepository';
import { useInfiniteContentByParent } from '../hooks/useContentQueries';

interface SavedTagFilterButtonProps {
  groupId: string;
  currentFilter: Tag[];
  onFilterApply: (tags: Tag[]) => void;
}

export const SavedTagFilterButton: React.FC<SavedTagFilterButtonProps> = ({
  groupId,
  currentFilter,
  onFilterApply
}) => {
  // Query for saved tag filters in this group
  const {
    data,
    isLoading,
    error
  } = useInfiniteContentByParent(
    groupId,
    null, // parent_content_id
    {
      viewMode: 'chronological'
    }
  );

  // Extract saved tag-filter content items
  const savedFilters = React.useMemo(() => {
    if (!data) return [];

    const allContent = data.pages.flatMap(page => page.items);
    return allContent.filter(content => content.type === 'tag-filter');
  }, [data]);

  // Check if a filter is currently active
  const isFilterActive = (filterMetadata: any) => {
    if (!filterMetadata?.tag_ids || !Array.isArray(filterMetadata.tag_ids)) {
      return false;
    }

    const filterTagIds = new Set(filterMetadata.tag_ids);
    const currentTagIds = new Set(currentFilter.map(t => t.id));

    if (filterTagIds.size !== currentTagIds.size) {
      return false;
    }

    return Array.from(filterTagIds).every(id => currentTagIds.has(id));
  };

  // Apply a saved filter
  const applyFilter = (filterContent: any) => {
    if (!filterContent.metadata?.tag_ids || !filterContent.metadata?.tag_names) {
      return;
    }

    const tags: Tag[] = filterContent.metadata.tag_ids.map((id: string, index: number) => ({
      id,
      name: filterContent.metadata.tag_names[index],
      created_at: '', // Not needed for filtering
      user_id: '', // Not needed for filtering
      color: filterContent.metadata.tag_colors?.[index] // Optional
    }));

    onFilterApply(tags);
  };

  if (isLoading || error || savedFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {savedFilters.map(filter => {
        const isActive = isFilterActive(filter.metadata);
        const filterName = filter.data || filter.metadata?.filter_name || 'Unnamed Filter';

        return (
          <button
            key={filter.id}
            onClick={() => applyFilter(filter)}
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
  );
};
