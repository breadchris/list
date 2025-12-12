"use client";

import { useState, useCallback } from "react";
import {
  X,
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  Folder,
  Plus,
  Search,
} from "lucide-react";
import type { WikiPageTreeNode, WikiPage } from "@/types/wiki";
import { titleToPath, pathToTitle } from "@/lib/wiki/path-utils";

interface WikiSidebarProps {
  /** Page tree structure */
  pageTree: WikiPageTreeNode[];
  /** Currently active page path */
  activePath?: string;
  /** Callback when a page is selected */
  onSelectPage: (page: WikiPage) => void;
  /** Callback to create a new page */
  onCreatePage: (path: string) => void;
  /** Close the sidebar */
  onClose: () => void;
  /** Get page data by path */
  getPage: (path: string) => WikiPage | undefined;
}

export function WikiSidebar({
  pageTree,
  activePath,
  onSelectPage,
  onCreatePage,
  onClose,
  getPage,
}: WikiSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [showNewPage, setShowNewPage] = useState(false);
  const [newPagePath, setNewPagePath] = useState("");

  // Toggle expanded state for a path
  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Handle page selection
  const handleSelectNode = useCallback(
    (node: WikiPageTreeNode) => {
      const page = getPage(node.path);
      if (page) {
        onSelectPage(page);
      }
    },
    [getPage, onSelectPage]
  );

  // Handle new page creation
  const handleCreatePage = useCallback(() => {
    if (!newPagePath.trim()) return;

    const path = titleToPath(newPagePath);
    onCreatePage(path);
    setNewPagePath("");
    setShowNewPage(false);
  }, [newPagePath, onCreatePage]);

  // Filter pages by search query
  const filterNodes = useCallback(
    (nodes: WikiPageTreeNode[]): WikiPageTreeNode[] => {
      if (!searchQuery.trim()) return nodes;

      const query = searchQuery.toLowerCase();

      const filterNode = (node: WikiPageTreeNode): WikiPageTreeNode | null => {
        const titleMatch = node.title.toLowerCase().includes(query);
        const pathMatch = node.path.toLowerCase().includes(query);

        // Filter children recursively
        const filteredChildren = node.children
          .map(filterNode)
          .filter((n): n is WikiPageTreeNode => n !== null);

        // Include node if it matches or has matching children
        if (titleMatch || pathMatch || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
          };
        }

        return null;
      };

      return nodes
        .map(filterNode)
        .filter((n): n is WikiPageTreeNode => n !== null);
    },
    [searchQuery]
  );

  const filteredTree = filterNodes(pageTree);

  return (
    <div className="w-64 h-full flex flex-col bg-neutral-900 border-r border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h2 className="text-neutral-200 font-medium">Pages</h2>
        <button
          onClick={onClose}
          className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
          title="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-neutral-800">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* New page form */}
      {showNewPage && (
        <div className="px-3 py-2 border-b border-neutral-800">
          <input
            type="text"
            placeholder="Page name..."
            value={newPagePath}
            onChange={(e) => setNewPagePath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreatePage();
              } else if (e.key === "Escape") {
                setShowNewPage(false);
                setNewPagePath("");
              }
            }}
            autoFocus
            className="w-full px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setShowNewPage(false);
                setNewPagePath("");
              }}
              className="px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePage}
              disabled={!newPagePath.trim()}
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Page tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {filteredTree.length === 0 ? (
          <div className="px-4 py-8 text-center text-neutral-500 text-sm">
            {searchQuery ? "No pages found" : "No pages yet"}
          </div>
        ) : (
          <PageTreeView
            nodes={filteredTree}
            activePath={activePath}
            expandedPaths={expandedPaths}
            onToggleExpanded={toggleExpanded}
            onSelectNode={handleSelectNode}
            depth={0}
          />
        )}
      </div>

      {/* Footer with new page button */}
      <div className="px-3 py-2 border-t border-neutral-800">
        <button
          onClick={() => setShowNewPage(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">New Page</span>
        </button>
      </div>
    </div>
  );
}

interface PageTreeViewProps {
  nodes: WikiPageTreeNode[];
  activePath?: string;
  expandedPaths: Set<string>;
  onToggleExpanded: (path: string) => void;
  onSelectNode: (node: WikiPageTreeNode) => void;
  depth: number;
}

function PageTreeView({
  nodes,
  activePath,
  expandedPaths,
  onToggleExpanded,
  onSelectNode,
  depth,
}: PageTreeViewProps) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedPaths.has(node.path);
        const isActive = activePath === node.path;

        return (
          <li key={node.path}>
            <div
              className={`flex items-center gap-1 px-2 py-1.5 mx-2 rounded cursor-pointer transition-colors ${
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "hover:bg-neutral-800 text-neutral-300"
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => onSelectNode(node)}
            >
              {/* Expand/collapse button */}
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpanded(node.path);
                  }}
                  className="p-0.5 hover:bg-neutral-700 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-4" /> // Spacer
              )}

              {/* Icon */}
              {hasChildren ? (
                isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-neutral-500" />
                ) : (
                  <Folder className="w-4 h-4 text-neutral-500" />
                )
              ) : (
                <FileText className="w-4 h-4 text-neutral-500" />
              )}

              {/* Title */}
              <span className="text-sm truncate">{node.title}</span>
            </div>

            {/* Children */}
            {hasChildren && isExpanded && (
              <PageTreeView
                nodes={node.children}
                activePath={activePath}
                expandedPaths={expandedPaths}
                onToggleExpanded={onToggleExpanded}
                onSelectNode={onSelectNode}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
