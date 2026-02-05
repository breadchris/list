"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useYDoc } from "@y-sweet/react";
import * as Y from "yjs";
import type { WikiPage, WikiPageTreeNode, WikiRenamePreview } from "@/types/wiki";
import {
  normalizePath,
  pathToTitle,
  getParentPath,
} from "@/lib/wiki/path-utils";
import {
  countWikiLinksInFragment,
  updateWikiLinksInFragment,
} from "@/lib/wiki/link-parser";

interface UseWikiPagesOptions {
  wiki_id: string;
}

interface UseWikiPagesReturn {
  /** All pages in the wiki */
  pages: Map<string, WikiPage>;
  /** Page tree for sidebar navigation */
  pageTree: WikiPageTreeNode[];
  /** Whether Y.js doc is ready */
  isReady: boolean;
  /** Get a page by path */
  getPage: (path: string) => WikiPage | undefined;
  /** Get a page by ID */
  getPageById: (id: string) => WikiPage | undefined;
  /** Create a new page */
  createPage: (path: string) => WikiPage;
  /** Rename a page (change its path) - simple version without child/link updates */
  renamePage: (pageId: string, newPath: string) => void;
  /** Rename a page and all children, updating all links */
  renamePageWithChildren: (pageId: string, newPath: string) => { success: boolean; error?: string };
  /** Get preview of pages affected by a rename */
  getRenamePreview: (pageId: string, newPath: string) => WikiRenamePreview | null;
  /** Delete a page */
  deletePage: (pageId: string) => void;
  /** Check if a page exists */
  pageExists: (path: string) => boolean;
}

/**
 * Build a tree structure from flat page list
 */
function buildPageTree(pages: Map<string, WikiPage>): WikiPageTreeNode[] {
  const tree: WikiPageTreeNode[] = [];
  const nodeMap = new Map<string, WikiPageTreeNode>();

  // Create nodes for all pages
  for (const [path, page] of pages) {
    nodeMap.set(path, {
      path,
      title: page.title,
      id: page.id,
      children: [],
    });
  }

  // Build tree by connecting parents to children
  for (const [path, node] of nodeMap) {
    const parentPath = getParentPath(path);

    if (parentPath && nodeMap.has(parentPath)) {
      // Add as child of parent
      nodeMap.get(parentPath)!.children.push(node);
    } else {
      // Top-level node
      tree.push(node);
    }
  }

  // Sort children alphabetically at each level
  const sortChildren = (nodes: WikiPageTreeNode[]) => {
    nodes.sort((a, b) => {
      // Index always first
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
}

/**
 * Hook for managing wiki pages
 *
 * All state is stored in Y.js:
 * - Page metadata in Y.Map('wiki-pages')
 * - Page content in Y.XmlFragment('wiki-page-{pageId}')
 *
 * No database operations - content is only persisted on explicit publish.
 */
export function useWikiPages({
  wiki_id,
}: UseWikiPagesOptions): UseWikiPagesReturn {
  const doc = useYDoc();

  // Pages state (derived from Y.js)
  const [pages, setPages] = useState<Map<string, WikiPage>>(new Map());

  // Y.js map for page metadata
  const pagesMap = useMemo(() => {
    if (!doc) return null;
    return doc.getMap<WikiPage>("wiki-pages");
  }, [doc]);

  // Sync pages from Y.js map to React state
  useEffect(() => {
    if (!pagesMap) return;

    const syncFromYjs = () => {
      const newPages = new Map<string, WikiPage>();
      pagesMap.forEach((page, path) => {
        newPages.set(path, page);
      });
      setPages(newPages);
    };

    // Initial sync
    syncFromYjs();

    // Listen for changes
    pagesMap.observe(syncFromYjs);
    return () => pagesMap.unobserve(syncFromYjs);
  }, [pagesMap]);

  // Get page by path
  // Read directly from Y.js map for synchronous access (avoids race condition)
  const getPage = useCallback(
    (path: string): WikiPage | undefined => {
      if (pagesMap) {
        return pagesMap.get(normalizePath(path));
      }
      return pages.get(normalizePath(path));
    },
    [pages, pagesMap]
  );

  // Get page by ID
  // Read directly from Y.js map for synchronous access (avoids race condition)
  const getPageById = useCallback(
    (id: string): WikiPage | undefined => {
      // Try Y.js map first for synchronous access
      if (pagesMap) {
        let found: WikiPage | undefined;
        pagesMap.forEach((page) => {
          if (page.id === id) found = page;
        });
        if (found) return found;
      }
      // Fallback to React state
      for (const page of pages.values()) {
        if (page.id === id) {
          return page;
        }
      }
      return undefined;
    },
    [pages, pagesMap]
  );

  // Check if page exists
  // Read directly from Y.js map for synchronous access (avoids race condition)
  const pageExists = useCallback(
    (path: string): boolean => {
      if (pagesMap) {
        return pagesMap.has(normalizePath(path));
      }
      return pages.has(normalizePath(path));
    },
    [pages, pagesMap]
  );

  // Create a new page (Y.js only, no database)
  const createPage = useCallback(
    (path: string): WikiPage => {
      if (!pagesMap || !doc) {
        throw new Error("Y.js document not ready");
      }

      const normalizedPath = normalizePath(path);

      // Return existing page if it already exists (idempotent)
      const existing = pagesMap.get(normalizedPath);
      if (existing) {
        return existing;
      }

      const title = pathToTitle(normalizedPath);
      const pageId = crypto.randomUUID();

      const newPage: WikiPage = {
        id: pageId,
        path: normalizedPath,
        title,
        wiki_id,
        created_at: new Date().toISOString(),
      };

      // Add to Y.js map (this triggers the observer and updates React state)
      pagesMap.set(normalizedPath, newPage);

      return newPage;
    },
    [wiki_id, pagesMap, doc]
  );

  // Rename a page (change its path)
  const renamePage = useCallback(
    (pageId: string, newPath: string): void => {
      if (!pagesMap || !doc) {
        throw new Error("Y.js document not ready");
      }

      const normalizedNewPath = normalizePath(newPath);

      // Check if target path already exists (and isn't the same page)
      const existingPage = pagesMap.get(normalizedNewPath);
      if (existingPage && existingPage.id !== pageId) {
        throw new Error(
          `A page with path '${normalizedNewPath}' already exists`
        );
      }

      const newTitle = pathToTitle(normalizedNewPath);

      // Find the old page
      let oldPath: string | undefined;
      let oldPage: WikiPage | undefined;

      pagesMap.forEach((page, path) => {
        if (page.id === pageId) {
          oldPath = path;
          oldPage = page;
        }
      });

      if (!oldPage || !oldPath) {
        throw new Error("Page not found");
      }

      // Update in Y.js (atomic transaction)
      doc.transact(() => {
        pagesMap.delete(oldPath!);
        pagesMap.set(normalizedNewPath, {
          ...oldPage!,
          path: normalizedNewPath,
          title: newTitle,
        });
      });
    },
    [pagesMap, doc]
  );

  // Delete a page
  const deletePage = useCallback(
    (pageId: string): void => {
      if (!pagesMap || !doc) {
        throw new Error("Y.js document not ready");
      }

      // Find the page path
      let pagePath: string | undefined;

      pagesMap.forEach((page, path) => {
        if (page.id === pageId) {
          pagePath = path;
        }
      });

      if (!pagePath) {
        throw new Error("Page not found");
      }

      // Delete from Y.js map
      pagesMap.delete(pagePath);

      // Note: The XmlFragment for this page remains in the Y.Doc
      // but won't be serialized during publish since the page metadata is gone
    },
    [pagesMap, doc]
  );

  // Get preview of pages affected by a rename
  const getRenamePreview = useCallback(
    (pageId: string, newPath: string): WikiRenamePreview | null => {
      if (!pagesMap || !doc) {
        return null;
      }

      const normalizedNewPath = normalizePath(newPath);

      // Find the page to rename
      let oldPath: string | undefined;
      let oldPage: WikiPage | undefined;
      pagesMap.forEach((page, path) => {
        if (page.id === pageId) {
          oldPath = path;
          oldPage = page;
        }
      });

      if (!oldPage || !oldPath) {
        return null;
      }

      // Find all pages to rename (this page + children)
      const pagesToRename: Array<{ old_path: string; new_path: string; title: string }> = [];
      const targetPaths = new Set<string>();

      pagesMap.forEach((page, path) => {
        if (path === oldPath || path.startsWith(oldPath + "/")) {
          const suffix = path.substring(oldPath!.length);
          const newPagePath = normalizedNewPath + suffix;
          pagesToRename.push({
            old_path: path,
            new_path: newPagePath,
            title: page.title,
          });
          targetPaths.add(path);
        }
      });

      // Find all pages that link to any of the pages being renamed
      const affectedPages: Array<{ path: string; title: string; link_count: number }> = [];
      let totalLinkUpdates = 0;

      pagesMap.forEach((page, path) => {
        // Skip pages being renamed
        if (targetPaths.has(path)) return;

        const fragment = doc.getXmlFragment(`wiki-page-${page.id}`);
        const linkCount = countWikiLinksInFragment(fragment, targetPaths);

        if (linkCount > 0) {
          affectedPages.push({
            path,
            title: page.title,
            link_count: linkCount,
          });
          totalLinkUpdates += linkCount;
        }
      });

      return {
        pages_to_rename: pagesToRename,
        affected_pages: affectedPages,
        total_link_updates: totalLinkUpdates,
      };
    },
    [pagesMap, doc]
  );

  // Rename a page and all children, updating all links
  const renamePageWithChildren = useCallback(
    (pageId: string, newPath: string): { success: boolean; error?: string } => {
      if (!pagesMap || !doc) {
        return { success: false, error: "Y.js document not ready" };
      }

      const normalizedNewPath = normalizePath(newPath);

      // Find the page to rename
      let oldPath: string | undefined;
      let oldPage: WikiPage | undefined;
      pagesMap.forEach((page, path) => {
        if (page.id === pageId) {
          oldPath = path;
          oldPage = page;
        }
      });

      if (!oldPage || !oldPath) {
        return { success: false, error: "Page not found" };
      }

      // Prevent renaming index page
      if (oldPath === "index") {
        return { success: false, error: "Cannot rename the index page" };
      }

      // Find all pages to rename (this page + children)
      const pagesToRename: Array<{ oldPath: string; newPath: string; page: WikiPage }> = [];
      const pathMapping = new Map<string, string>();

      pagesMap.forEach((page, path) => {
        if (path === oldPath || path.startsWith(oldPath + "/")) {
          const suffix = path.substring(oldPath!.length);
          const newPagePath = normalizedNewPath + suffix;
          pagesToRename.push({
            oldPath: path,
            newPath: newPagePath,
            page,
          });
          pathMapping.set(path, newPagePath);
        }
      });

      // Check for path conflicts (new paths must not exist unless it's one of our pages)
      const ourPageIds = new Set(pagesToRename.map((p) => p.page.id));
      for (const item of pagesToRename) {
        const existingPage = pagesMap.get(item.newPath);
        if (existingPage && !ourPageIds.has(existingPage.id)) {
          return {
            success: false,
            error: `A page with path '${item.newPath}' already exists`,
          };
        }
      }

      // Perform atomic rename in Y.js transaction
      doc.transact(() => {
        // 1. Update page metadata (delete old paths, add new)
        for (const item of pagesToRename) {
          pagesMap.delete(item.oldPath);
          const newTitle = pathToTitle(item.newPath);
          pagesMap.set(item.newPath, {
            ...item.page,
            path: item.newPath,
            title: newTitle,
          });
        }

        // 2. Update wikiLinks in ALL other pages
        const affectedPaths = new Set(pagesToRename.map((p) => p.oldPath));
        pagesMap.forEach((page, path) => {
          // Skip pages being renamed (they don't need link updates)
          if (affectedPaths.has(path)) return;

          const fragment = doc.getXmlFragment(`wiki-page-${page.id}`);
          updateWikiLinksInFragment(fragment, pathMapping);
        });
      });

      return { success: true };
    },
    [pagesMap, doc]
  );

  // Build page tree
  const pageTree = useMemo(() => buildPageTree(pages), [pages]);

  return {
    pages,
    pageTree,
    isReady: !!doc,
    getPage,
    getPageById,
    createPage,
    renamePage,
    renamePageWithChildren,
    getRenamePreview,
    deletePage,
    pageExists,
  };
}
