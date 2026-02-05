"use client";

import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { WikiDockTab } from "./wiki-dock-tab";
import type { WikiPanel, WikiPage } from "@/types/wiki";

interface WikiDockProps {
  /** Collapsed panels to display as tabs */
  panels: WikiPanel[];
  /** All panels (for reordering) */
  allPanels: WikiPanel[];
  /** Get page data by path */
  getPage: (path: string) => WikiPage | undefined;
  /** Get page data by ID */
  getPageById: (id: string) => WikiPage | undefined;
  /** Currently active panel ID */
  activePanelId: string | null;
  /** Callback to restore (expand) a panel */
  onRestore: (panelId: string) => void;
  /** Callback to reorder panels */
  onReorder: (fromIndex: number, toIndex: number) => void;
}

/**
 * Dock container for collapsed wiki panels.
 * Displays as a vertical sidebar with tabs for each collapsed panel.
 */
export function WikiDock({
  panels,
  allPanels,
  getPage,
  getPageById,
  activePanelId,
  onRestore,
  onReorder,
}: WikiDockProps) {
  // DnD sensors for dock tab reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  // Handle drag end for dock tab reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Find indices in the full panels array (not just collapsed)
      const fromIndex = allPanels.findIndex((p) => p.id === active.id);
      const toIndex = allPanels.findIndex((p) => p.id === over.id);

      if (fromIndex !== -1 && toIndex !== -1) {
        onReorder(fromIndex, toIndex);
      }
    }
  }, [allPanels, onReorder]);

  if (panels.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={panels.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <aside className="w-12 h-full bg-neutral-950 border-r border-neutral-800 flex flex-col overflow-y-auto overflow-x-hidden flex-shrink-0">
          {panels.map((panel) => {
            // Try to get page by ID first, then by path
            const page = getPageById(panel.page_id) || getPage(panel.page_path);
            const pageTitle = page?.title || panel.page_path;

            return (
              <WikiDockTab
                key={panel.id}
                panel={panel}
                pageTitle={pageTitle}
                isActive={panel.id === activePanelId}
                onRestore={() => onRestore(panel.id)}
                isDraggable={panels.length > 1}
                selectedForAIContext={panel.selected_for_ai_context}
              />
            );
          })}
        </aside>
      </SortableContext>
    </DndContext>
  );
}
