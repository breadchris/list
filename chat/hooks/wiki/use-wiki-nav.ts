"use client";

import { useState, useCallback, useMemo } from "react";
import type {
  WikiPanel,
  WikiNavMode,
  WikiNavContext,
  WikiLinkClickEvent,
  WikiSettings,
  DEFAULT_WIKI_SETTINGS,
} from "@/types/wiki";
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
        },
      ];
    }
    return [];
  });

  // Active panel index
  const [activePanelIndex, setActivePanelIndex] = useState(0);

  // Generate unique panel ID
  const generatePanelId = useCallback(() => {
    return `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Open a new page in a new panel
  const openPage = useCallback(
    (pagePath: string, pageId: string) => {
      const normalizedPath = normalizePath(pagePath);

      // Check if page is already open
      const existingIndex = panels.findIndex(
        (p) => p.page_path === normalizedPath
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
  };
}
