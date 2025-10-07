import React, { useState } from 'react';
import { Tag } from './ContentRepository';
import { TagSelector } from './TagSelector';

interface TagButtonProps {
  contentId: string;
  existingTags: Tag[];
  isVisible: boolean; // Controlled by parent hover state
}

export const TagButton: React.FC<TagButtonProps> = ({
  contentId,
  existingTags,
  isVisible
}) => {
  const [showSelector, setShowSelector] = useState(false);

  const handleButtonClick = (e: React.MouseEvent) => {
    // Prevent event from bubbling to parent (which would trigger navigation)
    e.stopPropagation();
    setShowSelector(!showSelector);
  };

  const handleClose = () => {
    setShowSelector(false);
  };

  const handleSave = () => {
    setShowSelector(false);
  };

  return (
    <>
      {/* Tag Button */}
      <button
        onClick={handleButtonClick}
        className={`
          text-gray-400 hover:text-gray-600
          p-0.5
          transition-opacity duration-200
          flex items-center gap-0.5
          text-xs
          ${isVisible ? 'opacity-100' : 'opacity-0'}
        `}
        title="Add tags"
        aria-label="Add tags to this item"
      >
        {/* Tag Icon */}
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
        {existingTags.length > 0 && (
          <span className="text-xs font-normal">
            {existingTags.length}
          </span>
        )}
      </button>

      {/* Tag Selector Modal */}
      {showSelector && (
        <TagSelector
          contentId={contentId}
          existingTags={existingTags}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </>
  );
};
