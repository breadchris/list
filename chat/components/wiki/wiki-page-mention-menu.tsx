"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FileText, Plus } from "lucide-react";
import type { WikiPage } from "@/types/wiki";

interface WikiPageMentionMenuProps {
  /** All wiki pages */
  pages: Map<string, WikiPage>;
  /** Current search query */
  query: string;
  /** Position for the dropdown */
  position: { top: number; left: number };
  /** Callback when a page is selected */
  onSelect: (path: string, exists: boolean) => void;
  /** Callback to close the menu */
  onClose: () => void;
  /** Current page path (to exclude from results) */
  currentPagePath: string;
  /** Whether user typed / prefix (absolute path mode) */
  isAbsoluteMode?: boolean;
}

interface MentionItem {
  path: string;
  exists: boolean;
  isCreate?: boolean;
}

export function WikiPageMentionMenu({
  pages,
  query,
  position,
  onSelect,
  onClose,
  currentPagePath,
  isAbsoluteMode = false,
}: WikiPageMentionMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Filter pages by query
  const filteredItems: MentionItem[] = [];
  // Strip leading / from query for filtering purposes
  const filterQuery = isAbsoluteMode && query.startsWith("/")
    ? query.slice(1).toLowerCase()
    : query.toLowerCase();

  for (const [path] of pages) {
    // Skip current page
    if (path === currentPagePath) continue;

    // Filter by path
    if (path.toLowerCase().includes(filterQuery)) {
      filteredItems.push({ path, exists: true });
    }
  }

  // Sort by path
  filteredItems.sort((a, b) => a.path.localeCompare(b.path));

  // Limit results
  const limitedItems = filteredItems.slice(0, 20);

  // Add "Create page" option if query doesn't match exactly
  // Check for exact match, accounting for / prefix in absolute mode
  const queryForMatch = isAbsoluteMode && query.startsWith("/")
    ? query.slice(1)
    : query;
  const exactMatch = pages.has(queryForMatch) || pages.has(queryForMatch.toLowerCase());
  if (query && !exactMatch && query.length > 0) {
    // Strip / prefix before sanitizing if in absolute mode
    const pathToSanitize = isAbsoluteMode && query.startsWith("/")
      ? query.slice(1)
      : query;
    // Sanitize path - convert spaces to dashes, lowercase
    const sanitizedPath = pathToSanitize
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-/]/g, "");

    if (sanitizedPath) {
      limitedItems.push({
        path: sanitizedPath,
        exists: false,
        isCreate: true,
      });
    }
  }

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (limitedItems.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) =>
            prev < limitedItems.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : limitedItems.length - 1
          );
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          e.stopPropagation();
          if (limitedItems[selectedIndex]) {
            const item = limitedItems[selectedIndex];
            // Prepend / for absolute mode
            const pathToReturn = isAbsoluteMode ? "/" + item.path : item.path;
            onSelect(pathToReturn, item.exists);
          }
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
      }
    };

    // Use capture phase to intercept before editor
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [limitedItems, selectedIndex, onSelect, onClose, isAbsoluteMode]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (limitedItems.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[200px] max-w-[300px] max-h-[300px] overflow-y-auto"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {isAbsoluteMode && (
        <div className="px-3 py-1 text-xs text-neutral-500 border-b border-neutral-700">
          From wiki root
        </div>
      )}
      {limitedItems.map((item, index) => (
        <button
          key={item.path}
          ref={index === selectedIndex ? selectedItemRef : null}
          onClick={() => {
            // Prepend / for absolute mode
            const pathToReturn = isAbsoluteMode ? "/" + item.path : item.path;
            onSelect(pathToReturn, item.exists);
          }}
          className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${
            index === selectedIndex
              ? "bg-blue-600 text-white"
              : "text-neutral-300 hover:bg-neutral-800"
          }`}
        >
          {item.isCreate ? (
            <>
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                Create &quot;{isAbsoluteMode ? "/" : ""}{item.path}&quot;
              </span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 flex-shrink-0 text-neutral-500" />
              <span className="truncate">{isAbsoluteMode ? "/" : ""}{item.path}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
