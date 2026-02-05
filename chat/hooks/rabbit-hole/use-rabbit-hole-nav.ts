import { useState, useCallback, useMemo } from "react";
import type { RabbitHolePanel, RabbitHolePage } from "@/types/rabbit-hole";

interface UseRabbitHoleNavOptions {
  pages: Record<string, RabbitHolePage>;
  rootPageId: string | null;
}

interface UseRabbitHoleNavReturn {
  panels: RabbitHolePanel[];
  activePanelIndex: number;
  openPage: (pageId: string) => void;
  closePanel: (index: number) => void;
  setActivePanel: (index: number) => void;
  closeAllAfter: (index: number) => void;
  reorderPanels: (fromIndex: number, toIndex: number) => void;
  resetPanels: () => void;
  initializePanels: (rootPageId: string) => void;
}

export function useRabbitHoleNav({
  pages,
  rootPageId,
}: UseRabbitHoleNavOptions): UseRabbitHoleNavReturn {
  const [panels, setPanels] = useState<RabbitHolePanel[]>(() => {
    // Initialize with root page if available
    if (rootPageId && pages[rootPageId]) {
      return [{ id: crypto.randomUUID(), page_id: rootPageId }];
    }
    return [];
  });
  const [activePanelIndex, setActivePanelIndex] = useState(0);

  // Open a page in a new panel (or focus if already open)
  const openPage = useCallback((pageId: string) => {
    setPanels((current) => {
      // Check if page is already open
      const existingIndex = current.findIndex((p) => p.page_id === pageId);
      if (existingIndex >= 0) {
        // Focus existing panel
        setActivePanelIndex(existingIndex);
        return current;
      }

      // Add new panel after the active one
      const newPanel: RabbitHolePanel = {
        id: crypto.randomUUID(),
        page_id: pageId,
      };

      const insertIndex = Math.min(current.length, activePanelIndex + 1);
      const newPanels = [
        ...current.slice(0, insertIndex),
        newPanel,
        ...current.slice(insertIndex),
      ];

      setActivePanelIndex(insertIndex);
      return newPanels;
    });
  }, [activePanelIndex]);

  // Close a panel at a specific index
  const closePanel = useCallback((index: number) => {
    setPanels((current) => {
      if (current.length <= 1) return current; // Keep at least one panel
      const newPanels = current.filter((_, i) => i !== index);

      // Adjust active index if needed
      setActivePanelIndex((currentActive) => {
        if (currentActive >= newPanels.length) {
          return Math.max(0, newPanels.length - 1);
        }
        if (index < currentActive) {
          return currentActive - 1;
        }
        return currentActive;
      });

      return newPanels;
    });
  }, []);

  // Set the active panel
  const setActivePanel = useCallback((index: number) => {
    setActivePanelIndex(index);
  }, []);

  // Close all panels after a specific index
  const closeAllAfter = useCallback((index: number) => {
    setPanels((current) => {
      const newPanels = current.slice(0, index + 1);
      setActivePanelIndex(Math.min(activePanelIndex, index));
      return newPanels;
    });
  }, [activePanelIndex]);

  // Reorder panels
  const reorderPanels = useCallback((fromIndex: number, toIndex: number) => {
    setPanels((current) => {
      const newPanels = [...current];
      const [moved] = newPanels.splice(fromIndex, 1);
      newPanels.splice(toIndex, 0, moved);

      // Adjust active index
      if (activePanelIndex === fromIndex) {
        setActivePanelIndex(toIndex);
      } else if (fromIndex < activePanelIndex && toIndex >= activePanelIndex) {
        setActivePanelIndex(activePanelIndex - 1);
      } else if (fromIndex > activePanelIndex && toIndex <= activePanelIndex) {
        setActivePanelIndex(activePanelIndex + 1);
      }

      return newPanels;
    });
  }, [activePanelIndex]);

  // Reset panels to initial state
  const resetPanels = useCallback(() => {
    if (rootPageId && pages[rootPageId]) {
      setPanels([{ id: crypto.randomUUID(), page_id: rootPageId }]);
      setActivePanelIndex(0);
    } else {
      setPanels([]);
      setActivePanelIndex(0);
    }
  }, [rootPageId, pages]);

  // Initialize panels with a specific root page
  const initializePanels = useCallback((newRootPageId: string) => {
    setPanels([{ id: crypto.randomUUID(), page_id: newRootPageId }]);
    setActivePanelIndex(0);
  }, []);

  return {
    panels,
    activePanelIndex,
    openPage,
    closePanel,
    setActivePanel,
    closeAllAfter,
    reorderPanels,
    resetPanels,
    initializePanels,
  };
}
