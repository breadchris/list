import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { Content } from './ContentRepository';
import { useParentsForContent } from '../hooks/useContentQueries';

interface PathSelectorProps {
  contentId: string | null;
  groupId: string;
  onNavigate: (contentId: string | null) => void;
}

/**
 * PathSelector component displays multiple parent paths for content items
 * Shows count of parent paths with expandable list to switch between them
 */
export const PathSelector: React.FC<PathSelectorProps> = ({
  contentId,
  groupId,
  onNavigate
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch all parents for current content
  const { data: parents = [], isLoading } = useParentsForContent(contentId || '');

  // If no contentId or no parents, don't show anything
  if (!contentId || parents.length === 0) {
    return null;
  }

  // Filter parents to only show those in the current group
  const groupParents = parents.filter(parent => parent.group_id === groupId);

  if (groupParents.length === 0) {
    return null;
  }

  const handleParentClick = (parentId: string) => {
    onNavigate(parentId);
    setIsExpanded(false);
  };

  const handleBackToRoot = () => {
    onNavigate(null);
    setIsExpanded(false);
  };

  return (
    <div className="relative inline-block">
      {/* Main button showing parent count */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>
          {groupParents.length} parent {groupParents.length === 1 ? 'path' : 'paths'}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Dropdown list of all parent paths */}
      {isExpanded && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* Back to root option */}
          <button
            onClick={handleBackToRoot}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">Back to root</span>
            </div>
          </button>

          {/* List of parents */}
          <div className="py-1">
            {groupParents.map((parent, index) => (
              <button
                key={parent.id}
                onClick={() => handleParentClick(parent.id)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b last:border-b-0 border-gray-100 dark:border-gray-700"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      Path {index + 1}
                    </span>
                  </div>
                  <div className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                    {parent.data}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {parent.type}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
};
