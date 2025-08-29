import { useState, useCallback } from 'react';
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
      
      // If no items selected, exit selection mode
      if (newSet.size === 0) {
        setIsSelectionMode(false);
      } else if (!isSelectionMode) {
        // Enter selection mode when first item is selected
        setIsSelectionMode(true);
      }
      
      return newSet;
    });
  }, [isSelectionMode]);

  const toggleSelectionMode = useCallback(() => {
    if (isSelectionMode) {
      // Exit selection mode and clear selections
      clearSelection();
    } else {
      // Enter selection mode
      setIsSelectionMode(true);
    }
  }, [isSelectionMode, clearSelection]);

  const getSelectedItems = useCallback((items: Content[]): Content[] => {
    return items.filter(item => selectedItems.has(item.id));
  }, [selectedItems]);

  return {
    selectedItems,
    isSelectionMode,
    selectAll,
    clearSelection,
    toggleItem,
    toggleSelectionMode,
    getSelectedItems,
    selectedCount: selectedItems.size
  };
};