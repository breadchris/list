import { useState, useCallback, useMemo } from 'react';
import { Content } from '../components/ContentRepository';

export interface ContentSelectionState {
  selectedItems: Set<string>;
  isSelectionMode: boolean;
  selectAll: (items: Content[]) => void;
  clearSelection: () => void;
  toggleItem: (itemId: string) => void;
  toggleSelectionMode: () => void;
  getSelectedItems: (items: Content[]) => Content[];
  selectedCount: number;
}

/**
 * Hook for managing content selection state in workflow mode
 */
export const useContentSelection = (): ContentSelectionState => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const selectAll = useCallback((items: Content[]) => {
    setSelectedItems(new Set(items.map(item => item.id)));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
    setIsSelectionMode(false);
  }, []);

  const toggleItem = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      
      // Handle selection mode state changes
      if (newSet.size === 0) {
        setIsSelectionMode(false);
      } else {
        setIsSelectionMode(true);
      }
      
      return newSet;
    });
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => {
      if (prev) {
        // Exit selection mode and clear selections
        setSelectedItems(new Set());
        return false;
      } else {
        // Enter selection mode
        return true;
      }
    });
  }, []);

  const getSelectedItems = useCallback((items: Content[]): Content[] => {
    return items.filter(item => selectedItems.has(item.id));
  }, [selectedItems]);

  return useMemo(() => ({
    selectedItems,
    isSelectionMode,
    selectAll,
    clearSelection,
    toggleItem,
    toggleSelectionMode,
    getSelectedItems,
    selectedCount: selectedItems.size
  }), [
    selectedItems,
    isSelectionMode,
    selectAll,
    clearSelection,
    toggleItem,
    toggleSelectionMode,
    getSelectedItems
  ]);
};