import { useState, useCallback } from 'react';

/**
 * Focus state for a content item
 */
export interface ContentFocusState {
  /** ID of the currently focused content item */
  focusedItemId: string | null;

  /** Set which item is focused (or null to clear) */
  setFocusedItem: (itemId: string | null) => void;

  /** Clear the current focus */
  clearFocus: () => void;

  /** Check if a specific item is focused */
  isFocused: (itemId: string) => boolean;

  /** Toggle focus for an item (focus if not focused, unfocus if focused) */
  toggleFocus: (itemId: string) => void;
}

/**
 * Hook for managing content focus state
 *
 * Focus mode allows a single content item to be "focused" at a time,
 * revealing action buttons and providing visual emphasis. This is separate
 * from selection mode (which is for batch operations).
 *
 * Usage:
 * ```typescript
 * const focus = useContentFocus();
 *
 * // Focus an item
 * focus.setFocusedItem(itemId);
 *
 * // Check if focused
 * if (focus.isFocused(itemId)) { ... }
 *
 * // Clear focus
 * focus.clearFocus();
 * ```
 */
export const useContentFocus = (): ContentFocusState => {
  const [focusedItemId, setFocusedItemIdState] = useState<string | null>(null);

  const setFocusedItem = useCallback((itemId: string | null) => {
    setFocusedItemIdState(itemId);
  }, []);

  const clearFocus = useCallback(() => {
    setFocusedItemIdState(null);
  }, []);

  const isFocused = useCallback((itemId: string) => {
    return focusedItemId === itemId;
  }, [focusedItemId]);

  const toggleFocus = useCallback((itemId: string) => {
    setFocusedItemIdState(current =>
      current === itemId ? null : itemId
    );
  }, []);

  return {
    focusedItemId,
    setFocusedItem,
    clearFocus,
    isFocused,
    toggleFocus,
  };
};
