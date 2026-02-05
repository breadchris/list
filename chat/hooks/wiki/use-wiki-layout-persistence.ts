"use client";

import { useEffect, useCallback, useRef } from "react";
import type { WikiPanel, WikiLayoutState } from "@/types/wiki";

const LAYOUT_STORAGE_PREFIX = "wiki-layout-";

/**
 * Get localStorage key for a wiki's layout state
 */
function getStorageKey(wikiId: string): string {
  return `${LAYOUT_STORAGE_PREFIX}${wikiId}`;
}

/**
 * Load layout state from localStorage
 */
export function loadLayoutState(wikiId: string): WikiLayoutState | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(getStorageKey(wikiId));
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        collapsed_panel_ids: parsed.collapsed_panel_ids || [],
        focused_panel_id: parsed.focused_panel_id || null,
        panel_order_paths: parsed.panel_order_paths || undefined,
        ai_context_selected_paths: parsed.ai_context_selected_paths || undefined,
      };
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

/**
 * Load saved panel paths from localStorage (for restoration on mount)
 */
export function loadSavedPanelPaths(wikiId: string): string[] | null {
  const savedState = loadLayoutState(wikiId);
  return savedState?.panel_order_paths || null;
}

/**
 * Save layout state to localStorage
 */
function saveLayoutState(wikiId: string, state: WikiLayoutState): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(getStorageKey(wikiId), JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

interface UseWikiLayoutPersistenceOptions {
  /** Wiki ID for storage key */
  wikiId: string;
  /** Current panels */
  panels: WikiPanel[];
  /** Current focused panel ID */
  focusedPanelId: string | null;
  /** Callback to restore a panel */
  restorePanel: (panelId: string) => void;
  /** Callback to collapse a panel */
  collapsePanel: (panelId: string) => void;
  /** Callback to enter focus mode */
  enterFocusMode: (panelId: string) => void;
  /** Callback to set panel order from saved paths */
  setPanelOrder: (orderedPagePaths: string[]) => void;
  /** Callback to apply AI context selections from saved paths */
  applyAIContextSelections: (selectedPaths: string[]) => void;
}

/**
 * Hook to persist and restore wiki layout state (collapsed panels, focus mode, panel order)
 *
 * - Loads saved state on mount and applies it to panels
 * - Saves state to localStorage when panels change (debounced)
 */
export function useWikiLayoutPersistence({
  wikiId,
  panels,
  focusedPanelId,
  restorePanel,
  collapsePanel,
  enterFocusMode,
  setPanelOrder,
  applyAIContextSelections,
}: UseWikiLayoutPersistenceOptions): void {
  // Track if initial load has been applied
  const hasAppliedInitialState = useRef(false);

  // Apply saved state on mount
  useEffect(() => {
    if (hasAppliedInitialState.current) return;
    if (panels.length === 0) return;

    const savedState = loadLayoutState(wikiId);
    if (!savedState) {
      hasAppliedInitialState.current = true;
      return;
    }

    // Apply panel order first (before collapse states)
    if (savedState.panel_order_paths && savedState.panel_order_paths.length > 0) {
      setPanelOrder(savedState.panel_order_paths);
    }

    // Apply collapsed states (use page_path to match since IDs are ephemeral)
    const collapsedPaths = new Set<string>();
    // Build a map from old panel IDs to page_paths from the saved panels
    // Since we can't rely on IDs, we use page_path for collapsed state too
    if (savedState.panel_order_paths) {
      // Match collapsed panels by their position in the order
      savedState.collapsed_panel_ids.forEach((id) => {
        // Find panel by ID in current panels and get its path
        const panel = panels.find((p) => p.id === id);
        if (panel) {
          collapsedPaths.add(panel.page_path);
        }
      });
    }

    panels.forEach((panel) => {
      // Try matching by page_path for collapse state
      if (collapsedPaths.has(panel.page_path) && !panel.collapsed) {
        collapsePanel(panel.id);
      }
    });

    // Apply focus mode if it was active (match by page_path)
    if (savedState.focused_panel_id) {
      const focusedPanel = panels.find((p) => p.id === savedState.focused_panel_id);
      if (focusedPanel) {
        enterFocusMode(savedState.focused_panel_id);
      }
    }

    // Apply AI context selections
    if (savedState.ai_context_selected_paths && savedState.ai_context_selected_paths.length > 0) {
      applyAIContextSelections(savedState.ai_context_selected_paths);
    }

    hasAppliedInitialState.current = true;
  }, [wikiId, panels, collapsePanel, enterFocusMode, setPanelOrder, applyAIContextSelections]);

  // Save state when it changes (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Don't save until initial state has been applied
    if (!hasAppliedInitialState.current) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 500ms
    saveTimeoutRef.current = setTimeout(() => {
      const state: WikiLayoutState = {
        collapsed_panel_ids: panels
          .filter((p) => p.collapsed)
          .map((p) => p.id),
        focused_panel_id: focusedPanelId,
        panel_order_paths: panels.map((p) => p.page_path),
        ai_context_selected_paths: panels
          .filter((p) => p.selected_for_ai_context)
          .map((p) => p.page_path),
      };

      saveLayoutState(wikiId, state);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [wikiId, panels, focusedPanelId]);
}
