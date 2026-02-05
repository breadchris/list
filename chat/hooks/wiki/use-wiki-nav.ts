"use client";

import { useState, useCallback, useMemo } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import type {
  WikiPanel,
  WikiPagePanel,
  WikiReaderPanel,
  WikiNavMode,
  WikiNavContext,
  WikiLinkClickEvent,
  WikiSettings,
  DEFAULT_WIKI_SETTINGS,
} from "@/types/wiki";
import { isPagePanel } from "@/types/wiki";
import { normalizePath } from "@/lib/wiki/path-utils";

const WIKI_SETTINGS_KEY = "wiki-settings";

/**
 * Load wiki settings from localStorage
 */
function loadSettings(): WikiSettings {
  if (typeof window === "undefined") {
    return { nav_mode: "new-panel" };
  }

  try {
    const stored = localStorage.getItem(WIKI_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }

  return { nav_mode: "new-panel" };
}

/**
 * Save wiki settings to localStorage
 */
function saveSettings(settings: WikiSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(WIKI_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

interface UseWikiNavOptions {
  wiki_id: string;
  initial_page_id?: string;
  initial_page_path?: string;
}

interface UseWikiNavReturn {
  /** Current open panels */
  panels: WikiPanel[];
  /** Index of the active panel */
  active_panel_index: number;
  /** Navigation mode setting */
  nav_mode: WikiNavMode;
  /** Full navigation context */
  context: WikiNavContext;
  /** Open a page in a new panel */
  openPage: (pagePath: string, pageId: string) => void;
  /** Replace the active panel with a new page */
  replacePage: (pagePath: string, pageId: string) => void;
  /** Handle a link click based on navigation mode and modifiers */
  handleLinkClick: (event: WikiLinkClickEvent, pageId: string) => void;
  /** Close a panel by index */
  closePanel: (panelIndex: number) => void;
  /** Close all panels after a given index */
  closePanelsAfter: (panelIndex: number) => void;
  /** Set the active panel */
  setActivePanel: (panelIndex: number) => void;
  /** Update navigation mode */
  setNavMode: (mode: WikiNavMode) => void;
  /** Go back to previous panel */
  goBack: () => void;
  /** Check if can go back */
  canGoBack: boolean;
  /** Collapse a panel to the dock */
  collapsePanel: (panelId: string) => void;
  /** Restore a collapsed panel */
  restorePanel: (panelId: string) => void;
  /** Enter focus mode for a panel (auto-collapses others) */
  enterFocusMode: (panelId: string) => void;
  /** Exit focus mode (restores previous collapse states) */
  exitFocusMode: () => void;
  /** ID of the focused panel (null = normal mode) */
  focused_panel_id: string | null;
  /** Whether we're in focus mode */
  isFocusMode: boolean;
  /** Reorder panels by moving from one index to another */
  reorderPanels: (fromIndex: number, toIndex: number) => void;
  /** Set panel order based on array of page_paths */
  setPanelOrder: (orderedPagePaths: string[]) => void;
  /** Toggle AI context selection for a panel */
  toggleAIContextSelection: (panelId: string) => void;
  /** Apply AI context selections from saved page paths */
  applyAIContextSelections: (selectedPaths: string[]) => void;
  /** Open multiple panels at once (for restoring saved state) */
  openMultiplePanels: (pages: Array<{path: string, id: string}>) => void;
  /** Open a book in a new reader panel */
  openBook: (bookContentId: string, bookTitle: string) => void;
}

/**
 * Hook for managing wiki navigation state
 *
 * Handles:
 * - Multi-panel navigation
 * - Link click behavior based on nav mode
 * - Panel open/close/replace operations
 * - Active panel tracking
 */
export function useWikiNav({
  wiki_id,
  initial_page_id,
  initial_page_path = "index",
}: UseWikiNavOptions): UseWikiNavReturn {
  // Load initial settings
  const [settings, setSettings] = useState<WikiSettings>(loadSettings);

  // Panels state
  const [panels, setPanels] = useState<WikiPanel[]>(() => {
    if (initial_page_id) {
      return [
        {
          id: `panel-${Date.now()}`,
          page_path: initial_page_path,
          page_id: initial_page_id,
          is_active: true,
          collapsed: false,
        },
      ];
    }
    return [];
  });

  // Active panel index
  const [activePanelIndex, setActivePanelIndex] = useState(0);

  // Focus mode state
  const [focusedPanelId, setFocusedPanelId] = useState<string | null>(null);

  // Store collapse states before entering focus mode (to restore on exit)
  const [preFocusCollapsedIds, setPreFocusCollapsedIds] = useState<Set<string>>(new Set());

  // Generate unique panel ID
  const generatePanelId = useCallback(() => {
    return `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Open a new page in a new panel
  const openPage = useCallback(
    (pagePath: string, pageId: string) => {
      const normalizedPath = normalizePath(pagePath);

      // Check if page is already open (only check page panels)
      const existingIndex = panels.findIndex(
        (p) => isPagePanel(p) && p.page_path === normalizedPath
      );

      if (existingIndex !== -1) {
        // Just activate the existing panel
        setActivePanelIndex(existingIndex);
        setPanels((prev) =>
          prev.map((p, i) => ({
            ...p,
            is_active: i === existingIndex,
          }))
        );
        return;
      }

      // Add new panel after the active panel
      const newPanel: WikiPanel = {
        id: generatePanelId(),
        page_path: normalizedPath,
        page_id: pageId,
        is_active: true,
        collapsed: false,
      };

      setPanels((prev) => {
        // Remove panels after active and add new one
        const newPanels: WikiPanel[] = prev.slice(0, activePanelIndex + 1).map((p) => ({
          ...p,
          is_active: false,
        }));
        newPanels.push(newPanel);
        return newPanels;
      });

      setActivePanelIndex((prev) => prev + 1);
    },
    [panels, activePanelIndex, generatePanelId]
  );

  // Replace the active panel with a new page
  const replacePage = useCallback(
    (pagePath: string, pageId: string) => {
      const normalizedPath = normalizePath(pagePath);

      setPanels((prev) => {
        const newPanels = [...prev];
        newPanels[activePanelIndex] = {
          id: generatePanelId(),
          page_path: normalizedPath,
          page_id: pageId,
          is_active: true,
          collapsed: false,
        };
        return newPanels;
      });
    },
    [activePanelIndex, generatePanelId]
  );

  // Handle link click based on nav mode and modifiers
  const handleLinkClick = useCallback(
    (event: WikiLinkClickEvent, pageId: string) => {
      const { path, mouse_event } = event;
      const hasModifier = mouse_event.metaKey || mouse_event.ctrlKey;

      // Determine behavior based on nav mode
      const shouldOpenNew =
        settings.nav_mode === "new-panel" ||
        (settings.nav_mode === "replace-with-modifier" && hasModifier);

      if (shouldOpenNew) {
        openPage(path, pageId);
      } else {
        replacePage(path, pageId);
      }
    },
    [settings.nav_mode, openPage, replacePage]
  );

  // Close a panel by index
  const closePanel = useCallback(
    (panelIndex: number) => {
      if (panels.length <= 1) {
        // Don't close the last panel
        return;
      }

      setPanels((prev) => prev.filter((_, i) => i !== panelIndex));

      // Adjust active panel index if needed
      if (panelIndex <= activePanelIndex) {
        setActivePanelIndex((prev) => Math.max(0, prev - 1));
      }
    },
    [panels.length, activePanelIndex]
  );

  // Close all panels after a given index
  const closePanelsAfter = useCallback(
    (panelIndex: number) => {
      setPanels((prev) => prev.slice(0, panelIndex + 1));

      if (activePanelIndex > panelIndex) {
        setActivePanelIndex(panelIndex);
      }
    },
    [activePanelIndex]
  );

  // Set the active panel
  const setActivePanel = useCallback((panelIndex: number) => {
    setActivePanelIndex(panelIndex);
    setPanels((prev) =>
      prev.map((p, i) => ({
        ...p,
        is_active: i === panelIndex,
      }))
    );
  }, []);

  // Update navigation mode
  const setNavMode = useCallback((mode: WikiNavMode) => {
    setSettings((prev) => {
      const newSettings = { ...prev, nav_mode: mode };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  // Go back to previous panel
  const goBack = useCallback(() => {
    if (activePanelIndex > 0) {
      setActivePanel(activePanelIndex - 1);
    }
  }, [activePanelIndex, setActivePanel]);

  // Collapse a panel to the dock
  const collapsePanel = useCallback((panelId: string) => {
    setPanels((prev) => {
      const panelIndex = prev.findIndex((p) => p.id === panelId);
      if (panelIndex === -1) return prev;

      // Don't allow collapsing if it's the only expanded panel
      const expandedPanels = prev.filter((p) => !p.collapsed);
      if (expandedPanels.length <= 1) return prev;

      return prev.map((p) =>
        p.id === panelId ? { ...p, collapsed: true, is_active: false } : p
      );
    });

    // If we collapsed the active panel, activate the next expanded one
    setPanels((prev) => {
      const activePanel = prev[activePanelIndex];
      if (activePanel?.collapsed) {
        const nextExpandedIndex = prev.findIndex((p) => !p.collapsed);
        if (nextExpandedIndex !== -1) {
          setActivePanelIndex(nextExpandedIndex);
          return prev.map((p, i) => ({
            ...p,
            is_active: i === nextExpandedIndex,
          }));
        }
      }
      return prev;
    });
  }, [activePanelIndex]);

  // Restore a collapsed panel
  const restorePanel = useCallback((panelId: string) => {
    setPanels((prev) =>
      prev.map((p) =>
        p.id === panelId ? { ...p, collapsed: false } : p
      )
    );
  }, []);

  // Enter focus mode for a panel (auto-collapses others)
  const enterFocusMode = useCallback((panelId: string) => {
    // Store current collapsed states to restore later
    setPanels((prev) => {
      const currentlyCollapsed = new Set(
        prev.filter((p) => p.collapsed).map((p) => p.id)
      );
      setPreFocusCollapsedIds(currentlyCollapsed);

      // Collapse all panels except the focused one
      return prev.map((p) => ({
        ...p,
        collapsed: p.id !== panelId,
        is_active: p.id === panelId,
      }));
    });

    setFocusedPanelId(panelId);

    // Update active panel index
    setPanels((prev) => {
      const focusedIndex = prev.findIndex((p) => p.id === panelId);
      if (focusedIndex !== -1) {
        setActivePanelIndex(focusedIndex);
      }
      return prev;
    });
  }, []);

  // Exit focus mode (restores previous collapse states)
  const exitFocusMode = useCallback(() => {
    if (!focusedPanelId) return;

    setPanels((prev) =>
      prev.map((p) => ({
        ...p,
        // Restore to collapsed state it had before focus mode
        collapsed: preFocusCollapsedIds.has(p.id),
      }))
    );

    setFocusedPanelId(null);
    setPreFocusCollapsedIds(new Set());
  }, [focusedPanelId, preFocusCollapsedIds]);

  // Reorder panels by moving from one index to another
  const reorderPanels = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    setPanels((prev) => {
      const newPanels = arrayMove(prev, fromIndex, toIndex);
      return newPanels;
    });

    // Adjust active panel index to follow the moved panel
    setActivePanelIndex((prevActiveIndex) => {
      if (prevActiveIndex === fromIndex) {
        return toIndex;
      }
      if (fromIndex < prevActiveIndex && toIndex >= prevActiveIndex) {
        return prevActiveIndex - 1;
      }
      if (fromIndex > prevActiveIndex && toIndex <= prevActiveIndex) {
        return prevActiveIndex + 1;
      }
      return prevActiveIndex;
    });
  }, []);

  // Set panel order based on array of page_paths (only affects page panels)
  const setPanelOrder = useCallback((orderedPagePaths: string[]) => {
    setPanels((prev) => {
      // Build a map of page_path -> panel (only for page panels)
      const panelsByPath = new Map<string, WikiPanel>();
      prev.forEach((p) => {
        if (isPagePanel(p)) {
          panelsByPath.set(p.page_path, p);
        }
      });

      // Reorder panels based on orderedPagePaths
      const reordered: WikiPanel[] = [];
      const seenIds = new Set<string>();

      // First, add panels in the saved order
      for (const path of orderedPagePaths) {
        const panel = panelsByPath.get(path);
        if (panel && !seenIds.has(panel.id)) {
          reordered.push(panel);
          seenIds.add(panel.id);
        }
      }

      // Then, add any remaining panels not in the saved order
      for (const panel of prev) {
        if (!seenIds.has(panel.id)) {
          reordered.push(panel);
        }
      }

      return reordered;
    });
  }, []);

  // Toggle AI context selection for a panel
  const toggleAIContextSelection = useCallback((panelId: string) => {
    setPanels((prev) =>
      prev.map((p) =>
        p.id === panelId
          ? { ...p, selected_for_ai_context: !p.selected_for_ai_context }
          : p
      )
    );
  }, []);

  // Apply AI context selections from saved page paths (only applies to page panels)
  const applyAIContextSelections = useCallback((selectedPaths: string[]) => {
    const pathSet = new Set(selectedPaths);
    setPanels((prev) =>
      prev.map((p) => ({
        ...p,
        selected_for_ai_context: isPagePanel(p) ? pathSet.has(p.page_path) : false,
      }))
    );
  }, []);

  // Open multiple panels at once (for restoring saved state)
  const openMultiplePanels = useCallback(
    (pagesToOpen: Array<{ path: string; id: string }>) => {
      if (pagesToOpen.length === 0) return;

      const newPanels: WikiPanel[] = pagesToOpen.map((p, i) => ({
        id: generatePanelId(),
        page_path: normalizePath(p.path),
        page_id: p.id,
        is_active: i === 0,
        collapsed: false,
      }));

      setPanels(newPanels);
      setActivePanelIndex(0);
    },
    [generatePanelId]
  );

  // Open a book in a new reader panel
  const openBook = useCallback(
    (bookContentId: string, bookTitle: string) => {
      // Check if book is already open
      const existingIndex = panels.findIndex(
        (p) => p.type === "reader" && (p as WikiReaderPanel).book_content_id === bookContentId
      );

      if (existingIndex !== -1) {
        // Just activate the existing panel
        setActivePanelIndex(existingIndex);
        setPanels((prev) =>
          prev.map((p, i) => ({
            ...p,
            is_active: i === existingIndex,
          }))
        );
        return;
      }

      // Create new reader panel
      const newPanel: WikiReaderPanel = {
        id: generatePanelId(),
        type: "reader",
        book_content_id: bookContentId,
        book_title: bookTitle,
        is_active: true,
        collapsed: false,
      };

      setPanels((prev) => {
        // Add new panel after the active panel
        const newPanels: WikiPanel[] = prev.slice(0, activePanelIndex + 1).map((p) => ({
          ...p,
          is_active: false,
        }));
        newPanels.push(newPanel);
        return newPanels;
      });

      setActivePanelIndex((prev) => prev + 1);
    },
    [panels, activePanelIndex, generatePanelId]
  );

  // Navigation context
  const context: WikiNavContext = useMemo(
    () => ({
      wiki_id,
      panels,
      active_panel_index: activePanelIndex,
      nav_mode: settings.nav_mode,
    }),
    [wiki_id, panels, activePanelIndex, settings.nav_mode]
  );

  return {
    panels,
    active_panel_index: activePanelIndex,
    nav_mode: settings.nav_mode,
    context,
    openPage,
    replacePage,
    handleLinkClick,
    closePanel,
    closePanelsAfter,
    setActivePanel,
    setNavMode,
    goBack,
    canGoBack: activePanelIndex > 0,
    collapsePanel,
    restorePanel,
    enterFocusMode,
    exitFocusMode,
    focused_panel_id: focusedPanelId,
    isFocusMode: focusedPanelId !== null,
    reorderPanels,
    setPanelOrder,
    toggleAIContextSelection,
    applyAIContextSelections,
    openMultiplePanels,
    openBook,
  };
}
