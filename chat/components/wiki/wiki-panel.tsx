"use client";

import { useState, useCallback } from "react";
import { X, ChevronLeft, MoreHorizontal, FileText, Trash2 } from "lucide-react";
import { WikiEditor } from "./wiki-editor";
import type { WikiPage, WikiPanel as WikiPanelType, WikiLinkClickEvent, WikiTemplate } from "@/types/wiki";
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
}: WikiPanelProps) {
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

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

  // Page doesn't exist yet
  if (!page) {
    return (
      <div
        className={`relative h-full flex flex-col bg-neutral-950 ${
          isActive ? "ring-1 ring-blue-500/30" : ""
        }`}
        style={{ width: width ? `${width}px` : undefined }}
        onClick={onActivate}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-neutral-500" />
            <span className="text-neutral-300 text-sm font-medium">
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
                className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
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
            <div className="text-neutral-500">Creating page...</div>
          ) : (
            <div className="text-center p-4">
              <div className="text-neutral-400 mb-4">
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
      className={`relative h-full flex flex-col bg-neutral-950 ${
        isActive ? "ring-1 ring-blue-500/30" : ""
      }`}
      style={{ width: width ? `${width}px` : undefined }}
      onClick={onActivate}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-neutral-500" />
          <span className="text-neutral-300 text-sm font-medium truncate max-w-[200px]">
            {page.title}
          </span>
          <span className="text-neutral-600 text-xs hidden sm:inline">
            {panel.page_path}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
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
                <div className="absolute right-0 top-full mt-1 z-20 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg py-1 min-w-[120px]">
                  {onDeletePage && !isFirst && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onDeletePage();
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-neutral-700 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Close button */}
          {!isFirst && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <WikiEditor
          key={page.id}
          page={page}
          onLinkClick={handleLinkClick}
          pageExists={pageExists}
          panelId={panel.id}
          isActive={isActive}
          templates={templates}
        />
      </div>

      {/* Resize handle (desktop only) */}
      {showResizeHandle && onResize && (
        <ResizeHandle currentWidth={width || 400} onResize={onResize} />
      )}
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
