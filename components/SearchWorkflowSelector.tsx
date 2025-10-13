import React from 'react';
import { WorkflowAction } from './WorkflowFAB';

interface SearchWorkflowSelectorProps {
  workflows: WorkflowAction[];
  isVisible: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearching: boolean;
}

export const SearchWorkflowSelector: React.FC<SearchWorkflowSelectorProps> = ({
  workflows,
  isVisible,
  onClose,
  searchQuery,
  onSearchChange,
  isSearching
}) => {
  if (!isVisible) return null;

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Search</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Search Section */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Search Your Content</h4>
          <div className="relative">
            <input
              type="text"
              placeholder="Search your content..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 my-3"></div>

        {/* External Search Section */}
        <div>
          <h4 className="text-xs font-medium text-gray-700 mb-2">Search External Sources</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {workflows.map((workflow) => (
              <button
                key={workflow.id}
                onClick={workflow.onClick}
                className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-all group"
              >
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                  {workflow.icon}
                </span>
                <h5 className="text-xs font-medium text-gray-900 mb-0.5">
                  {workflow.name}
                </h5>
                <p className="text-[10px] text-gray-500 text-center leading-tight">
                  {workflow.description}
                </p>
              </button>
            ))}
          </div>

          {workflows.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-xs">No external search sources available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
