"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, GripVertical } from "lucide-react";
import type { WikiPanel } from "@/types/wiki";

interface WikiDockTabProps {
  /** The collapsed panel */
  panel: WikiPanel;
  /** Page title to display */
  pageTitle: string;
  /** Whether this tab is for the active panel */
  isActive: boolean;
  /** Callback to restore (expand) the panel */
  onRestore: () => void;
  /** Whether this tab can be dragged to reorder */
  isDraggable?: boolean;
  /** Whether this panel is selected for AI context */
  selectedForAIContext?: boolean;
}

/**
 * A vertical tab representing a collapsed wiki panel in the dock.
 * Clicking restores the panel to its expanded state.
 */
export function WikiDockTab({
  panel,
  pageTitle,
  isActive,
  onRestore,
  isDraggable = false,
  selectedForAIContext = false,
}: WikiDockTabProps) {
  // Sortable hook for drag-to-reorder
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: panel.id,
    disabled: !isDraggable,
  });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      className={`
        group relative w-12 min-h-[100px] flex flex-col items-center justify-center
        ${selectedForAIContext ? "bg-purple-900/20" : "bg-neutral-900"} hover:bg-neutral-800 border-b border-neutral-800
        transition-colors
        ${isActive ? "bg-neutral-800 border-l-2 border-l-blue-500" : ""}
        ${isDragging ? "opacity-50 z-50" : ""}
      `}
    >
      {/* AI context indicator dot */}
      {selectedForAIContext && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-400" />
      )}

      {/* Drag handle */}
      {isDraggable && (
        <button
          className="absolute top-1 touch-none cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3 h-3" />
        </button>
      )}

      {/* Click area to restore */}
      <button
        onClick={onRestore}
        className="flex-1 flex flex-col items-center justify-center w-full cursor-pointer pt-4"
        title={`Restore: ${pageTitle}`}
      >
        {/* Icon at top */}
        <FileText className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 mb-2 flex-shrink-0" />

        {/* Vertical text */}
        <span
          className="text-xs text-neutral-400 group-hover:text-neutral-200 truncate max-h-[60px] overflow-hidden"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            transform: "rotate(180deg)",
          }}
        >
          {pageTitle}
        </span>
      </button>
    </div>
  );
}
