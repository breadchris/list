"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useYDoc } from "@y-sweet/react";
import * as Y from "yjs";
import type { WikiPage, WikiPageTreeNode } from "@/types/wiki";
import {
  normalizePath,
  pathToTitle,
  getParentPath,
} from "@/lib/wiki/path-utils";

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
  /** Rename a page (change its path) */
  renamePage: (pageId: string, newPath: string) => void;
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
    deletePage,
    pageExists,
  };
}
