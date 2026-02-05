"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, BookOpen, Minus, Maximize2, Minimize2, GripVertical } from "lucide-react";
import { ReaderAppInterface } from "@/components/reader-app-interface";
import type { WikiReaderPanel as WikiReaderPanelType } from "@/types/wiki";
import { useGlobalGroup } from "@/components/GlobalGroupContext";

interface WikiReaderPanelProps {
  /** Panel data */
  panel: WikiReaderPanelType;
  /** Whether this panel is active */
  isActive: boolean;
  /** Whether this is the first panel (can't close) */
  isFirst: boolean;
  /** Close this panel */
  onClose: () => void;
  /** Set this panel as active */
  onActivate: () => void;
  /** Panel width (desktop only) */
  width?: number;
  /** Whether this panel is in focus mode */
  isFocused?: boolean;
  /** Collapse this panel to the dock */
  onCollapse?: () => void;
  /** Enter focus mode for this panel */
  onFocus?: () => void;
  /** Exit focus mode */
  onExitFocus?: () => void;
  /** Whether collapse is allowed (need at least 2 expanded panels) */
  canCollapse?: boolean;
  /** Whether this panel can be dragged to reorder */
  isDraggable?: boolean;
}

/**
 * A wiki panel that displays an EPUB reader
 */
export function WikiReaderPanel({
  panel,
  isActive,
  isFirst,
  onClose,
  onActivate,
  width,
  isFocused = false,
  onCollapse,
  onFocus,
  onExitFocus,
  canCollapse = true,
  isDraggable = false,
}: WikiReaderPanelProps) {
  const { selectedGroup } = useGlobalGroup();

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
      className={`relative h-full flex flex-col bg-background ${
        isFocused
          ? "ring-2 ring-blue-500/50"
          : isActive
          ? "ring-1 ring-blue-500/30"
          : ""
      } ${isDragging ? "opacity-50 z-50" : ""}`}
      style={{ ...sortableStyle, width: width ? `${width}px` : undefined }}
      onClick={onActivate}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          {isDraggable && (
            <button
              className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground shrink-0"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <span className="text-foreground text-sm font-medium truncate max-w-[200px]">
            {panel.book_title || "Book"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Collapse button (only when can collapse and not focused) */}
          {canCollapse && !isFocused && onCollapse && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCollapse();
              }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Collapse to dock"
            >
              <Minus className="w-4 h-4" />
            </button>
          )}

          {/* Focus/Exit Focus button */}
          {isFocused ? (
            onExitFocus && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExitFocus();
                }}
                className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                title="Exit focus mode"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            )
          ) : (
            onFocus && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFocus();
                }}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                title="Focus mode"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )
          )}

          {/* Close button (hide when focused - use exit focus instead) */}
          {!isFirst && !isFocused && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Reader */}
      <div className="flex-1 overflow-hidden pb-16">
        <ReaderAppInterface
          bookContentId={panel.book_content_id}
          groupId={selectedGroup?.id || null}
        />
      </div>
    </div>
  );
}
