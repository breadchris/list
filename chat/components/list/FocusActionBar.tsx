import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { Content } from '@/lib/list/ContentRepository';
import { ContentSelectionState } from '@/hooks/list/useContentSelection';
import { VoteButtons } from './VoteButtons';
import { TagButton } from './TagButton';
import { TagSelector } from './TagSelector';

interface FocusActionBarProps {
  contentItem: Content;
  groupId: string;
  selection: ContentSelectionState;
  onNavigate: (contentId: string) => void;
  hasChildren?: boolean;
  userId?: string | null;
}

/**
 * FocusActionBar - Action buttons displayed when content is focused
 *
 * Shows five actions in focus mode:
 * 1. Select - Add to selection for batch operations
 * 2. Tag - Add/edit tags
 * 3. Vote - Upvote/downvote
 * 4. View - Navigate to content page
 * 5. Navigate/Open - Navigate to nested content or open link (conditional)
 */
export const FocusActionBar: React.FC<FocusActionBarProps> = ({
  contentItem,
  groupId,
  selection,
  onNavigate,
  hasChildren = false,
  userId,
}) => {
  const router = useRouter();
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const isSelected = selection.selectedItems.has(contentItem.id);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Enter selection mode if not already in it
    if (!selection.isSelectionMode) {
      selection.toggleSelectionMode();
    }
    selection.toggleItem(contentItem.id);
  };

  const handleTag = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTagSelectorOpen(true);
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Navigate to nested content if has children
    if (hasChildren) {
      onNavigate(contentItem.id);
      return;
    }

    // Open external link if content has a URL
    const urlMatch = contentItem.data.match(/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/i);
    if (urlMatch) {
      window.open(urlMatch[0], '_blank', 'noopener,noreferrer');
    }
  };

  const hasUrl = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/i.test(contentItem.data);
  const showNavigateButton = hasChildren || hasUrl;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex items-center gap-2 justify-center pt-2 mt-2 overflow-hidden"
      >
        {/* Select Button */}
        <button
          onClick={handleSelect}
          className={`
            flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium
            transition-colors
            ${isSelected
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }
          `}
          title={isSelected ? 'Remove from selection' : 'Add to selection'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isSelected ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : (
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
            )}
          </svg>
          <span>Select</span>
        </button>

        {/* Tag Button */}
        <button
          onClick={handleTag}
          className="
            flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium
            bg-white border border-gray-300 text-gray-700
            hover:bg-gray-50 transition-colors
          "
          title="Add or edit tags"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span>Tag</span>
          {contentItem.tags && contentItem.tags.length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
              {contentItem.tags.length}
            </span>
          )}
        </button>

        {/* Vote Buttons - Horizontal layout for focus mode */}
        <div className="flex items-center gap-0.5 px-2 py-1 bg-white border border-gray-300 rounded-md">
          <VoteButtons
            contentId={contentItem.id}
            groupId={groupId}
            isVisible={true}
            userId={userId}
            layout="horizontal"
          />
        </div>

        {/* View Button - Navigate to content page */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/group/${groupId}/content/${contentItem.id}`);
          }}
          className="
            flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium
            bg-blue-600 text-white hover:bg-blue-700 transition-colors
          "
          title="View full page"
        >
          <ExternalLink className="w-4 h-4" />
          <span>View</span>
        </button>

        {/* Navigate/Open Button */}
        {showNavigateButton && (
          <button
            onClick={handleNavigate}
            className="
              flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium
              bg-blue-600 text-white hover:bg-blue-700 transition-colors
            "
            title={hasChildren ? 'View nested content' : 'Open link'}
          >
            {hasChildren ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>Open</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>Open</span>
              </>
            )}
          </button>
        )}
      </motion.div>

      {/* Tag Selector Modal */}
      {isTagSelectorOpen && (
        <TagSelector
          contentId={contentItem.id}
          groupId={groupId}
          currentTags={contentItem.tags || []}
          onClose={() => setIsTagSelectorOpen(false)}
        />
      )}
    </>
  );
};
