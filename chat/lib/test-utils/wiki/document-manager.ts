/**
 * Wiki Document Manager - Wraps Y.Doc for wiki-specific operations
 */

import * as Y from "yjs";
import type { WikiPage, WikiTemplate } from "@/types/wiki";
import { normalizePath, pathToTitle } from "@/lib/wiki/path-utils";

const PAGES_MAP_KEY = "wiki-pages";
const TEMPLATES_MAP_KEY = "wiki-templates";

/**
 * Manager for wiki Y.js document operations
 */
export class WikiDocumentManager {
  private doc: Y.Doc;

  constructor(doc: Y.Doc) {
    this.doc = doc;
  }

  /**
   * Get the Y.Map containing all wiki pages
   */
  get pagesMap(): Y.Map<WikiPage> {
    return this.doc.getMap<WikiPage>(PAGES_MAP_KEY);
  }

  /**
   * Get the Y.Map containing all wiki templates
   */
  get templatesMap(): Y.Map<WikiTemplate> {
    return this.doc.getMap<WikiTemplate>(TEMPLATES_MAP_KEY);
  }

  /**
   * Get all pages as an array
   */
  getPages(): WikiPage[] {
    const pages: WikiPage[] = [];
    this.pagesMap.forEach((page) => {
      pages.push(page);
    });
    return pages.sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Get a page by path
   */
  getPage(path: string): WikiPage | undefined {
    return this.pagesMap.get(path);
  }

  /**
   * Get a page by ID
   */
  getPageById(id: string): WikiPage | undefined {
    for (const page of this.pagesMap.values()) {
      if (page.id === id) {
        return page;
      }
    }
    return undefined;
  }

  /**
   * Get all templates as an array
   */
  getTemplates(): WikiTemplate[] {
    const templates: WikiTemplate[] = [];
    this.templatesMap.forEach((template) => {
      templates.push(template);
    });
    return templates.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): WikiTemplate | undefined {
    return this.templatesMap.get(id);
  }

  /**
   * Get the Y.XmlFragment for a page's content
   */
  getPageContent(pageId: string): Y.XmlFragment {
    return this.doc.getXmlFragment(`wiki-page-${pageId}`);
  }

  /**
   * Create a new page (idempotent - returns existing page if exists)
   * Does not touch page content - only creates metadata
   */
  createPage(path: string, wikiId: string): WikiPage {
    const normalizedPath = normalizePath(path);

    // Return existing page if exists (idempotent)
    const existing = this.pagesMap.get(normalizedPath);
    if (existing) {
      return existing;
    }

    const newPage: WikiPage = {
      id: crypto.randomUUID(),
      path: normalizedPath,
      title: pathToTitle(normalizedPath),
      wiki_id: wikiId,
      created_at: new Date().toISOString(),
    };

    this.pagesMap.set(normalizedPath, newPage);
    return newPage;
  }

  /**
   * Execute a transaction on the document
   */
  transact(fn: () => void): void {
    this.doc.transact(fn);
  }
}
