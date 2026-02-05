"use client";

import { useState, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, ChevronLeft, MoreHorizontal, FileText, Trash2, Minus, Maximize2, Minimize2, GripVertical, Sparkles, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WikiEditor } from "./wiki-editor";
import type { WikiPage, WikiPanel as WikiPanelType, WikiLinkClickEvent, WikiTemplate, WikiRenamePreview } from "@/types/wiki";
import { pathToTitle } from "@/lib/wiki/path-utils";

interface WikiPanelProps {
  /** Panel data */
  panel: WikiPanelType;
  /** Page data */
  page: WikiPage | undefined;
  /** Whether this panel is active */
  isActive: boolean;
  /** Whether this is the first panel (can't close) */
  isFirst: boolean;
  /** Panel index */
  index: number;
  /** Callback when a wiki link is clicked */
  onLinkClick: (event: WikiLinkClickEvent, pageId: string) => void;
  /** Check if a page exists */
  pageExists: (path: string) => boolean;
  /** Close this panel */
  onClose: () => void;
  /** Set this panel as active */
  onActivate: () => void;
  /** Create a new page at path (synchronous, stored in Y.js) */
  onCreatePage: (path: string) => WikiPage;
  /** Delete the page */
  onDeletePage?: () => void;
  /** Whether to show resize handle */
  showResizeHandle?: boolean;
  /** Panel width (desktop only) */
  width?: number;
  /** Callback for resize */
  onResize?: (width: number) => void;
  /** Available templates for slash commands */
  templates?: WikiTemplate[];
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
  /** All wiki pages for mention search */
  pages: Map<string, WikiPage>;
  /** Whether this panel can be dragged to reorder */
  isDraggable?: boolean;
  /** Whether this panel is selected for AI context */
  selectedForAIContext?: boolean;
  /** Callback to toggle AI context selection */
  onToggleAIContext?: () => void;
  /** Get rename preview for a page */
  getRenamePreview?: (currentPath: string, newPath: string) => WikiRenamePreview | null;
  /** Rename a page and its children */
  onRenamePage?: (oldPath: string, newPath: string) => { success: boolean; error?: string };
}

export function WikiPanel({
  panel,
  page,
  isActive,
  isFirst,
  index,
  onLinkClick,
  pageExists,
  onClose,
  onActivate,
  onCreatePage,
  onDeletePage,
  showResizeHandle = false,
  width,
  onResize,
  templates,
  isFocused = false,
  onCollapse,
  onFocus,
  onExitFocus,
  canCollapse = true,
  pages,
  isDraggable = false,
  selectedForAIContext = false,
  onToggleAIContext,
  getRenamePreview,
  onRenamePage,
}: WikiPanelProps) {
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Rename dialog state
  const [pageRenameDialogOpen, setPageRenameDialogOpen] = useState(false);
  const [newPagePath, setNewPagePath] = useState("");
  const [renamePreview, setRenamePreview] = useState<WikiRenamePreview | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);

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

  // Handle link clicks
  const handleLinkClick = useCallback(
    (event: WikiLinkClickEvent) => {
      // Check if page exists
      const exists = pageExists(event.path);

      if (!exists) {
        // Create the page first (synchronous, stored in Y.js)
        try {
          const newPage = onCreatePage(event.path);
          onLinkClick(event, newPage.id);
        } catch (error) {
          console.error("Failed to create page:", error);
        }
      } else {
        // Page exists, navigate to it
        onLinkClick(event, page?.id || "");
      }
    },
    [pageExists, onCreatePage, onLinkClick, page?.id]
  );

  // Handle rename path change with preview
  const handlePagePathChange = useCallback(
    (value: string) => {
      setNewPagePath(value);
      setRenameError(null);

      if (!getRenamePreview || !page) {
        setRenamePreview(null);
        return;
      }

      // Only get preview if path is different and valid
      if (value && value !== page.path) {
        const preview = getRenamePreview(page.path, value);
        setRenamePreview(preview);
      } else {
        setRenamePreview(null);
      }
    },
    [getRenamePreview, page]
  );

  // Handle page rename
  const handlePageRename = useCallback(() => {
    if (!onRenamePage || !page || !newPagePath.trim() || newPagePath === page.path) {
      return;
    }

    const result = onRenamePage(page.path, newPagePath.trim());
    if (result.success) {
      setPageRenameDialogOpen(false);
      setNewPagePath("");
      setRenamePreview(null);
      setRenameError(null);
    } else {
      setRenameError(result.error || "Failed to rename page");
    }
  }, [onRenamePage, page, newPagePath]);

  // Page doesn't exist yet
  if (!page) {
    return (
      <div
        ref={setNodeRef}
        className={`relative h-full flex flex-col bg-background ${
          isActive ? "ring-1 ring-blue-500/30" : ""
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
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground text-sm font-medium">
              {pathToTitle(panel.page_path)}
            </span>
            <span className="text-orange-400 text-xs">(new)</span>
          </div>
          <div className="flex items-center gap-1">
            {!isFirst && (
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

        {/* Creating page indicator */}
        <div className="flex-1 flex items-center justify-center">
          {isCreatingPage ? (
            <div className="text-muted-foreground">Creating page...</div>
          ) : (
            <div className="text-center p-4">
              <div className="text-muted-foreground mb-4">
                Page does not exist yet
              </div>
              <button
                onClick={() => {
                  try {
                    onCreatePage(panel.page_path);
                  } catch (error) {
                    console.error("Failed to create page:", error);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
              >
                Create Page
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

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
      <div className={`flex items-center justify-between px-4 py-3 border-b border-border ${
        selectedForAIContext ? "bg-purple-500/10" : ""
      }`}>
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
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-foreground text-sm font-medium truncate max-w-[200px]">
            {page.title}
          </span>
          <span className="text-muted-foreground/60 text-xs hidden sm:inline">
            {panel.page_path}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* AI Context toggle button */}
          {onToggleAIContext && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleAIContext();
              }}
              className={`p-1 transition-colors ${
                selectedForAIContext
                  ? "text-purple-400 hover:text-purple-300"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={selectedForAIContext ? "Remove from AI context" : "Add to AI context"}
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}

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

          {/* Menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-muted border border-border rounded-md shadow-lg py-1 min-w-[120px]">
                  {/* Rename option - not for index page */}
                  {onRenamePage && !isFirst && page.path !== "index" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        setNewPagePath(page.path);
                        setRenamePreview(null);
                        setRenameError(null);
                        setPageRenameDialogOpen(true);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-accent flex items-center gap-2"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Rename
                    </button>
                  )}
                  {onDeletePage && !isFirst && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onDeletePage();
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-accent flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

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

      {/* Editor */}
      <div className={`flex-1 overflow-hidden ${isFocused ? "flex justify-center" : ""}`}>
        <div className={isFocused ? "w-full max-w-3xl px-8" : "w-full h-full"}>
        <WikiEditor
          key={page.id}
          page={page}
          onLinkClick={handleLinkClick}
          pageExists={pageExists}
          panelId={panel.id}
          isActive={isActive}
          templates={templates}
          pages={pages}
          onCreatePage={onCreatePage}
        />
        </div>
      </div>

      {/* Resize handle (desktop only) */}
      {showResizeHandle && onResize && (
        <ResizeHandle currentWidth={width || 400} onResize={onResize} />
      )}

      {/* Rename page dialog */}
      <Dialog
        open={pageRenameDialogOpen}
        onOpenChange={(open) => {
          setPageRenameDialogOpen(open);
          if (!open) {
            setRenamePreview(null);
            setRenameError(null);
          }
        }}
      >
        <DialogContent className="bg-neutral-900 border-neutral-800 max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-neutral-100">Rename Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Path input */}
            <div>
              <label className="text-sm text-neutral-400 mb-1.5 block">New path</label>
              <input
                type="text"
                value={newPagePath}
                onChange={(e) => handlePagePathChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePageRename();
                  if (e.key === "Escape") setPageRenameDialogOpen(false);
                }}
                placeholder="page-path"
                autoFocus
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Error message */}
            {renameError && (
              <p className="text-sm text-red-400">{renameError}</p>
            )}

            {/* Preview section */}
            {renamePreview && (
              <div className="space-y-3 text-sm">
                {/* Pages to rename */}
                {renamePreview.pages_to_rename.length > 1 && (
                  <div>
                    <p className="text-neutral-400 mb-1.5">
                      Pages to rename ({renamePreview.pages_to_rename.length}):
                    </p>
                    <ul className="space-y-1 max-h-24 overflow-y-auto bg-neutral-800/50 rounded-lg p-2">
                      {renamePreview.pages_to_rename.map((p) => (
                        <li key={p.old_path} className="flex items-center gap-2 text-xs">
                          <span className="text-neutral-500 truncate">{p.old_path}</span>
                          <span className="text-neutral-600 flex-shrink-0">→</span>
                          <span className="text-teal-400 truncate">{p.new_path}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Affected pages with links */}
                {renamePreview.affected_pages.length > 0 && (
                  <div>
                    <p className="text-neutral-400 mb-1.5">
                      Links to update ({renamePreview.total_link_updates}):
                    </p>
                    <ul className="space-y-1 max-h-24 overflow-y-auto bg-neutral-800/50 rounded-lg p-2">
                      {renamePreview.affected_pages.map((p) => (
                        <li key={p.path} className="flex items-center justify-between text-xs">
                          <span className="text-neutral-300 truncate">{p.title}</span>
                          <span className="text-neutral-500 flex-shrink-0 ml-2">
                            {p.link_count} {p.link_count === 1 ? "link" : "links"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* No changes info */}
                {renamePreview.pages_to_rename.length === 1 && renamePreview.affected_pages.length === 0 && (
                  <p className="text-neutral-500 text-xs">
                    No other pages link to this page.
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPageRenameDialogOpen(false)}
                className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePageRename}
                disabled={!newPagePath.trim() || newPagePath === page.path}
                className="px-3 py-1.5 text-sm text-white bg-teal-600 hover:bg-teal-500 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-lg transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ResizeHandleProps {
  currentWidth: number;
  onResize: (width: number) => void;
}

function ResizeHandle({ currentWidth, onResize }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startWidth = currentWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.max(200, Math.min(800, startWidth + delta));
        onResize(newWidth);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [currentWidth, onResize]
  );

  return (
    <div
      className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors ${
        isDragging ? "bg-blue-500" : "bg-transparent"
      }`}
      onMouseDown={handleMouseDown}
    />
  );
}
