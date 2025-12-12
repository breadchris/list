"use client";

import { useState, useCallback, useEffect } from "react";
import { useYDoc } from "@y-sweet/react";
import * as Y from "yjs";
import type {
  WikiPage,
  WikiPageMetadata,
  WikiMetadata,
  WikiPageTreeNode,
  WIKI_CONTENT_TYPE,
  WIKI_PAGE_CONTENT_TYPE,
} from "@/types/wiki";
import { contentRepository } from "@/lib/list/ContentRepository";
import {
  normalizePath,
  pathToTitle,
  getParentPath,
  isChildPath,
} from "@/lib/wiki/path-utils";

interface UseWikiPagesOptions {
  wiki_id: string;
  group_id: string;
}

interface UseWikiPagesReturn {
  /** All pages in the wiki */
  pages: Map<string, WikiPage>;
  /** Page tree for sidebar navigation */
  pageTree: WikiPageTreeNode[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Get a page by path */
  getPage: (path: string) => WikiPage | undefined;
  /** Get a page by ID */
  getPageById: (id: string) => WikiPage | undefined;
  /** Create a new page */
  createPage: (path: string, initialContent?: string) => Promise<WikiPage>;
  /** Update a page's content */
  updatePage: (pageId: string, content: string) => Promise<void>;
  /** Rename a page (change its path) */
  renamePage: (pageId: string, newPath: string) => Promise<void>;
  /** Delete a page */
  deletePage: (pageId: string) => Promise<void>;
  /** Check if a page exists */
  pageExists: (path: string) => boolean;
  /** Refresh pages from database */
  refresh: () => Promise<void>;
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
 * Handles:
 * - Loading pages from database
 * - Creating/updating/deleting pages
 * - Building page tree for navigation
 * - Real-time sync via Y.js
 */
export function useWikiPages({
  wiki_id,
  group_id,
}: UseWikiPagesOptions): UseWikiPagesReturn {
  const doc = useYDoc();

  // Pages state
  const [pages, setPages] = useState<Map<string, WikiPage>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Y.js map for page metadata sync
  const pagesMap = doc?.getMap<WikiPage>(`wiki-pages-${wiki_id}`);

  // Load pages from database
  const loadPages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Query all wiki-page content items for this wiki
      // Using getContentByParent with correct signature: (groupId, parentId, offset, limit)
      const result = await contentRepository.getContentByParent(
        group_id,
        wiki_id,
        0,
        1000 // Get all pages
      );

      const newPages = new Map<string, WikiPage>();

      for (const content of result) {
        if (content.type === "wiki-page") {
          const metadata = content.metadata as WikiPageMetadata | null;
          const path = metadata?.path || content.id;

          newPages.set(normalizePath(path), {
            id: content.id,
            path: normalizePath(path),
            title: metadata?.title || pathToTitle(path),
            wiki_id,
            data: content.data || "",
            created_at: content.created_at,
            updated_at: content.updated_at,
          });
        }
      }

      setPages(newPages);

      // Sync to Y.js
      if (pagesMap) {
        doc?.transact(() => {
          pagesMap.clear();
          for (const [path, page] of newPages) {
            pagesMap.set(path, page);
          }
        });
      }
    } catch (err) {
      console.error("Failed to load wiki pages:", err);
      setError("Failed to load wiki pages");
    } finally {
      setIsLoading(false);
    }
  }, [wiki_id, group_id, doc, pagesMap]);

  // Load pages on mount
  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // Listen for Y.js changes
  useEffect(() => {
    if (!pagesMap) return;

    const observer = () => {
      const newPages = new Map<string, WikiPage>();
      pagesMap.forEach((page, path) => {
        newPages.set(path, page);
      });
      setPages(newPages);
    };

    pagesMap.observe(observer);
    return () => pagesMap.unobserve(observer);
  }, [pagesMap]);

  // Get page by path
  const getPage = useCallback(
    (path: string): WikiPage | undefined => {
      return pages.get(normalizePath(path));
    },
    [pages]
  );

  // Get page by ID
  const getPageById = useCallback(
    (id: string): WikiPage | undefined => {
      for (const page of pages.values()) {
        if (page.id === id) {
          return page;
        }
      }
      return undefined;
    },
    [pages]
  );

  // Check if page exists
  const pageExists = useCallback(
    (path: string): boolean => {
      return pages.has(normalizePath(path));
    },
    [pages]
  );

  // Create a new page
  const createPage = useCallback(
    async (path: string, initialContent: string = ""): Promise<WikiPage> => {
      const normalizedPath = normalizePath(path);
      const title = pathToTitle(normalizedPath);

      // Create in database
      const content = await contentRepository.createContent({
        type: "wiki-page",
        data: initialContent,
        group_id,
        parent_content_id: wiki_id,
        metadata: {
          path: normalizedPath,
          title,
          wiki_id,
        } as Record<string, unknown>,
      });

      const newPage: WikiPage = {
        id: content.id,
        path: normalizedPath,
        title,
        wiki_id,
        data: initialContent,
        created_at: content.created_at,
        updated_at: content.updated_at,
      };

      // Update local state
      setPages((prev) => {
        const newPages = new Map(prev);
        newPages.set(normalizedPath, newPage);
        return newPages;
      });

      // Sync to Y.js
      if (pagesMap) {
        pagesMap.set(normalizedPath, newPage);
      }

      return newPage;
    },
    [wiki_id, group_id, pagesMap]
  );

  // Update a page's content
  const updatePage = useCallback(
    async (pageId: string, content: string): Promise<void> => {
      await contentRepository.updateContent(pageId, {
        data: content,
      });

      // Update local state
      setPages((prev) => {
        const newPages = new Map(prev);
        for (const [path, page] of newPages) {
          if (page.id === pageId) {
            newPages.set(path, {
              ...page,
              data: content,
              updated_at: new Date().toISOString(),
            });
            break;
          }
        }
        return newPages;
      });
    },
    []
  );

  // Rename a page (change its path)
  const renamePage = useCallback(
    async (pageId: string, newPath: string): Promise<void> => {
      const normalizedNewPath = normalizePath(newPath);
      const newTitle = pathToTitle(normalizedNewPath);

      // Find the old page
      let oldPath: string | undefined;
      let oldPage: WikiPage | undefined;

      for (const [path, page] of pages) {
        if (page.id === pageId) {
          oldPath = path;
          oldPage = page;
          break;
        }
      }

      if (!oldPage || !oldPath) {
        throw new Error("Page not found");
      }

      // Update in database
      await contentRepository.updateContent(pageId, {
        metadata: {
          path: normalizedNewPath,
          title: newTitle,
          wiki_id,
        } as Record<string, unknown>,
      });

      // Update local state
      setPages((prev) => {
        const newPages = new Map(prev);
        newPages.delete(oldPath!);
        newPages.set(normalizedNewPath, {
          ...oldPage!,
          path: normalizedNewPath,
          title: newTitle,
          updated_at: new Date().toISOString(),
        });
        return newPages;
      });

      // Sync to Y.js
      if (pagesMap) {
        doc?.transact(() => {
          pagesMap.delete(oldPath!);
          pagesMap.set(normalizedNewPath, {
            ...oldPage!,
            path: normalizedNewPath,
            title: newTitle,
            updated_at: new Date().toISOString(),
          });
        });
      }
    },
    [pages, wiki_id, doc, pagesMap]
  );

  // Delete a page
  const deletePage = useCallback(
    async (pageId: string): Promise<void> => {
      // Find the page path
      let pagePath: string | undefined;

      for (const [path, page] of pages) {
        if (page.id === pageId) {
          pagePath = path;
          break;
        }
      }

      if (!pagePath) {
        throw new Error("Page not found");
      }

      // Delete from database
      await contentRepository.deleteContent(pageId);

      // Update local state
      setPages((prev) => {
        const newPages = new Map(prev);
        newPages.delete(pagePath!);
        return newPages;
      });

      // Sync to Y.js
      if (pagesMap) {
        pagesMap.delete(pagePath);
      }
    },
    [pages, pagesMap]
  );

  // Build page tree
  const pageTree = buildPageTree(pages);

  return {
    pages,
    pageTree,
    isLoading,
    error,
    getPage,
    getPageById,
    createPage,
    updatePage,
    renamePage,
    deletePage,
    pageExists,
    refresh: loadPages,
  };
}
