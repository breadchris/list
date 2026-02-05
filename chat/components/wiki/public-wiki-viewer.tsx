"use client";

/**
 * Public Wiki Viewer
 *
 * Displays a read-only view of a wiki using live Y.js connection.
 * Reuses wiki editor components with editable={false}.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  Folder,
  Search,
  ExternalLink,
} from "lucide-react";
import * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import { useReadonlyWikiDoc } from "@/hooks/wiki/use-readonly-wiki-doc";
import { useWikiPresence } from "@/hooks/wiki/use-wiki-presence";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { wikiSchema } from "./wiki-schema";
import { resolvePath, getParentPath, normalizePath } from "@/lib/wiki/path-utils";
import { WikiCursorOverlay } from "./wiki-cursor-overlay";
import { CurrentlyViewingSection } from "./wiki-currently-viewing";
import type { WikiPage, WikiPageTreeNode } from "@/types/wiki";

import "@blocknote/shadcn/style.css";
import "@blocknote/core/fonts/inter.css";

interface PublicWikiViewerProps {
  wikiId: string;
  initialPath?: string;
}

/**
 * Public wiki viewer with live Y.js readonly connection
 */
export function PublicWikiViewer({
  wikiId,
  initialPath = "index",
}: PublicWikiViewerProps) {
  const { doc, provider, awareness, is_ready, connection_status, error } = useReadonlyWikiDoc({
    wiki_id: wikiId,
  });

  // Show loading state
  if (!is_ready || !doc) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-gray-500 mb-2">
            {connection_status === 'connecting' ? 'Connecting...' : 'Loading wiki...'}
          </div>
          {error && (
            <div className="text-red-500 text-sm">
              Failed to load wiki. Please try again.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <PublicWikiViewerInner
      wikiId={wikiId}
      initialPath={initialPath}
      doc={doc}
      awareness={awareness}
    />
  );
}

interface PublicWikiViewerInnerProps {
  wikiId: string;
  initialPath: string;
  doc: Y.Doc;
  awareness: Awareness | null;
}

function PublicWikiViewerInner({
  wikiId,
  initialPath,
  doc,
  awareness,
}: PublicWikiViewerInnerProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePath, setActivePath] = useState(initialPath);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Presence tracking
  const {
    viewers_on_current_page,
    active_pages,
    local_state,
  } = useWikiPresence({
    awareness,
    current_page_path: activePath,
    editor_container_ref: containerRef,
  });

  // Get pages from Y.js map
  const pagesMap = useMemo(() => doc.getMap<WikiPage>("wiki-pages"), [doc]);

  // Subscribe to pages changes
  const [pages, setPages] = useState<Map<string, WikiPage>>(new Map());

  useEffect(() => {
    const syncFromYjs = () => {
      const newPages = new Map<string, WikiPage>();
      pagesMap.forEach((page, path) => {
        newPages.set(path, page);
      });
      setPages(newPages);
    };

    syncFromYjs();
    pagesMap.observe(syncFromYjs);
    return () => pagesMap.unobserve(syncFromYjs);
  }, [pagesMap]);

  // Get wiki title from index page or first page
  const wikiTitle = useMemo(() => {
    const indexPage = pages.get("index");
    if (indexPage) return indexPage.title;
    const firstPage = pages.values().next().value;
    return firstPage?.title || "Wiki";
  }, [pages]);

  // Build page tree
  const pageTree = useMemo(() => {
    const tree: WikiPageTreeNode[] = [];
    const nodeMap = new Map<string, WikiPageTreeNode>();

    for (const [path, page] of pages) {
      nodeMap.set(path, {
        path,
        title: page.title,
        id: page.id,
        children: [],
      });
    }

    for (const [path, node] of nodeMap) {
      const parentPath = getParentPath(path);
      if (parentPath && nodeMap.has(parentPath)) {
        nodeMap.get(parentPath)!.children.push(node);
      } else {
        tree.push(node);
      }
    }

    // Sort
    const sortChildren = (nodes: WikiPageTreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.path === "index") return -1;
        if (b.path === "index") return 1;
        return a.title.localeCompare(b.title);
      });
      for (const node of nodes) {
        sortChildren(node.children);
      }
    };
    sortChildren(tree);

    return tree;
  }, [pages]);

  // Get current page
  const currentPage = useMemo(() => {
    return pages.get(activePath);
  }, [pages, activePath]);

  // Get page fragment for editor
  const fragment = useMemo(() => {
    if (!currentPage) return null;
    return doc.getXmlFragment(`wiki-page-${currentPage.id}`);
  }, [doc, currentPage]);

  // Navigation handler
  const navigateToPage = useCallback((path: string) => {
    const normalizedPath = normalizePath(path);
    if (pages.has(normalizedPath)) {
      setActivePath(normalizedPath);
      setSidebarOpen(false);
      window.history.pushState(null, "", `/wiki/pub/${wikiId}/${normalizedPath}`);
    }
  }, [pages, wikiId]);

  // Handle wiki link clicks
  useEffect(() => {
    if (!containerRef.current) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const wikiLink = target.closest("[data-wiki-link]");

      if (wikiLink) {
        event.preventDefault();
        const pagePath = wikiLink.getAttribute("data-page-path");
        if (pagePath) {
          const resolvedPath = resolvePath(activePath, pagePath);
          navigateToPage(resolvedPath);
        }
      }
    };

    containerRef.current.addEventListener("click", handleClick);
    return () => containerRef.current?.removeEventListener("click", handleClick);
  }, [activePath, navigateToPage]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const pathMatch = window.location.pathname.match(/\/wiki\/pub\/[^/]+\/?(.*)/);
      const path = pathMatch?.[1] || "index";
      setActivePath(path);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Toggle expanded
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

  // Filter pages by search
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return pageTree;

    const query = searchQuery.toLowerCase();

    const filterNode = (node: WikiPageTreeNode): WikiPageTreeNode | null => {
      const titleMatch = node.title.toLowerCase().includes(query);
      const pathMatch = node.path.toLowerCase().includes(query);
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is WikiPageTreeNode => n !== null);

      if (titleMatch || pathMatch || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };

    return pageTree
      .map(filterNode)
      .filter((n): n is WikiPageTreeNode => n !== null);
  }, [pageTree, searchQuery]);

  return (
    <div className="h-screen bg-white overflow-hidden">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium text-gray-900 truncate">
            {wikiTitle}
          </h1>
          <p className="text-xs text-gray-500 truncate">
            {currentPage?.title || activePath}
          </p>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-72 bg-gray-50 border-r border-gray-200
          flex flex-col
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 truncate">{wikiTitle}</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 -mr-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Currently Viewing - presence indicator */}
        <CurrentlyViewingSection
          active_pages={active_pages}
          pages={pages}
          current_path={activePath}
          onNavigate={navigateToPage}
        />

        {/* Page tree */}
        <nav className="flex-1 overflow-y-auto p-2">
          {filteredTree.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              {searchQuery ? "No pages found" : "No pages yet"}
            </div>
          ) : (
            <PageTreeView
              nodes={filteredTree}
              activePath={activePath}
              expandedPaths={expandedPaths}
              onToggleExpanded={toggleExpanded}
              onNavigate={navigateToPage}
              depth={0}
            />
          )}
        </nav>

        {/* Footer - no New Page button for readonly */}
        <div className="px-3 py-2 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            Read-only view
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-72 pt-16 lg:pt-0 h-full overflow-y-auto">
        {/* Desktop header */}
        <header className="hidden lg:block border-b border-gray-200 px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {currentPage?.title || activePath}
          </h1>
        </header>

        {/* Content area */}
        <article ref={containerRef} className="relative px-4 py-6 lg:px-8 lg:py-8">
          {/* Cursor overlay for presence */}
          <WikiCursorOverlay viewers={viewers_on_current_page} />

          <div className="max-w-4xl mx-auto">
            {currentPage && fragment ? (
              <ReadonlyWikiEditor
                fragment={fragment}
                pageExists={(path) => pages.has(normalizePath(path))}
                awareness={awareness}
                userName={local_state?.display_name || "Reader"}
                userColor={local_state?.color || "#888888"}
              />
            ) : (
              <div className="text-gray-500">Page not found</div>
            )}

            {/* Footer */}
            <footer className="mt-12 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Published wiki &middot;{" "}
                <a
                  href="/"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Create your own <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </footer>
          </div>
        </article>
      </main>
    </div>
  );
}

interface ReadonlyWikiEditorProps {
  fragment: Y.XmlFragment;
  pageExists: (path: string) => boolean;
  awareness: Awareness | null;
  userName: string;
  userColor: string;
}

/**
 * Readonly BlockNote editor for viewing wiki content
 */
function ReadonlyWikiEditor({
  fragment,
  pageExists,
  awareness,
  userName,
  userColor,
}: ReadonlyWikiEditorProps) {
  // Create editor with collaboration (readonly via fragment)
  const editor = useCreateBlockNote(
    {
      schema: wikiSchema,
      collaboration: {
        provider: awareness ? { awareness } as any : { awareness: null } as any,
        fragment: fragment,
        user: { name: userName, color: userColor },
      },
    },
    [fragment, awareness, userName, userColor]
  );

  return (
    <BlockNoteView
      editor={editor}
      editable={false}
      theme="light"
      className="min-h-[200px]"
    />
  );
}

interface PageTreeViewProps {
  nodes: WikiPageTreeNode[];
  activePath: string;
  expandedPaths: Set<string>;
  onToggleExpanded: (path: string) => void;
  onNavigate: (path: string) => void;
  depth: number;
}

function PageTreeView({
  nodes,
  activePath,
  expandedPaths,
  onToggleExpanded,
  onNavigate,
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
              className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                isActive
                  ? "bg-blue-100 text-blue-700"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => onNavigate(node.path)}
            >
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpanded(node.path);
                  }}
                  className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-4" />
              )}

              {hasChildren ? (
                isExpanded ? (
                  <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <Folder className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )
              ) : (
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}

              <span className="text-sm truncate">{node.title}</span>
            </div>

            {hasChildren && isExpanded && (
              <PageTreeView
                nodes={node.children}
                activePath={activePath}
                expandedPaths={expandedPaths}
                onToggleExpanded={onToggleExpanded}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
