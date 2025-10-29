import { useState, useMemo, useCallback } from 'react';
import { Tag as TagIcon } from 'lucide-react';
import type { PieMenuItem } from '../components/pie/PieMenu';
import type { Content } from '../components/ContentRepository';
import { useTagsForGroup } from './useTagQueries';
import { useRecentTags } from './useRecentTags';
import { useAddTagToContentMutation } from './useTagMutations';

interface UseContentPieMenuReturn {
  isPieMenuOpen: boolean;
  pieMenuPosition: { x: number; y: number };
  pieMenuItems: PieMenuItem[];
  selectedContentId: string | null;
  handleContextMenu: (e: React.MouseEvent, content: Content) => void;
  closePieMenu: () => void;
}

/**
 * Hook to manage pie menu for applying recently used tags to content
 * - Shows pie menu on right-click of content
 * - Displays up to 6 most recently used tags
 * - Filters out tags already applied to the content
 * - Records tag use after successful application
 */
export const useContentPieMenu = (groupId: string | null): UseContentPieMenuReturn => {
  const [isPieMenuOpen, setIsPieMenuOpen] = useState(false);
  const [pieMenuPosition, setPieMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  // Get all tags for the group
  const { data: allTags = [] } = useTagsForGroup(groupId || '');

  // Get recent tags tracker
  const { getAvailableRecentTags, recordTagUse } = useRecentTags(groupId);

  // Get tag mutation
  const addTagMutation = useAddTagToContentMutation();

  // Generate pie menu items from available recent tags
  const pieMenuItems = useMemo((): PieMenuItem[] => {
    if (!selectedContent) return [];

    // Get tag IDs already applied to this content
    const appliedTagIds = selectedContent.tags?.map(tag => tag.id) || [];

    // Get up to 6 available recent tags (excluding already-applied)
    const availableTags = getAvailableRecentTags(allTags, appliedTagIds, 6);

    // Convert tags to pie menu items
    return availableTags.map(tag => ({
      id: tag.id,
      icon: TagIcon,
      label: tag.name,
      color: tag.color,
      onClick: async () => {
        if (!selectedContentId) return;

        try {
          // Apply tag to content
          await addTagMutation.mutateAsync({
            contentId: selectedContentId,
            tagId: tag.id
          });

          // Record tag use (moves to front of recent list)
          recordTagUse(tag.id);

          console.log(`✅ Applied tag "${tag.name}" to content ${selectedContentId}`);
        } catch (error) {
          console.error('Failed to apply tag:', error);
        }
      }
    }));
  }, [selectedContent, allTags, getAvailableRecentTags, selectedContentId, addTagMutation, recordTagUse]);

  // Handle context menu (right-click)
  const handleContextMenu = useCallback((e: React.MouseEvent, content: Content) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedContent(content);
    setSelectedContentId(content.id);
    setPieMenuPosition({ x: e.clientX, y: e.clientY });
    setIsPieMenuOpen(true);
  }, []);

  // Close pie menu
  const closePieMenu = useCallback(() => {
    setIsPieMenuOpen(false);
    setSelectedContent(null);
    setSelectedContentId(null);
  }, []);

  return {
    isPieMenuOpen,
    pieMenuPosition,
    pieMenuItems,
    selectedContentId,
    handleContextMenu,
    closePieMenu
  };
};
