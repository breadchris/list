/**
 * Wiki Operations - High-level operations for wiki Y.js documents
 */

import { WikiDocumentManager } from "./document-manager";
import type { WikiPage, WikiTemplate } from "@/types/wiki";

/**
 * Wiki state containing all pages and templates
 */
export interface WikiState {
  pages: WikiPage[];
  templates: WikiTemplate[];
  page_count: number;
  template_count: number;
}

/**
 * Get the full state of the wiki document
 */
export function getWikiState(docManager: WikiDocumentManager): WikiState {
  const pages = docManager.getPages();
  const templates = docManager.getTemplates();

  return {
    pages,
    templates,
    page_count: pages.length,
    template_count: templates.length,
  };
}

/**
 * List all pages in the wiki
 */
export function listPages(docManager: WikiDocumentManager): WikiPage[] {
  return docManager.getPages();
}

/**
 * List all templates in the wiki
 */
export function listTemplates(docManager: WikiDocumentManager): WikiTemplate[] {
  return docManager.getTemplates();
}

/**
 * Get a specific page by path
 */
export function getPage(
  docManager: WikiDocumentManager,
  path: string
): WikiPage | undefined {
  return docManager.getPage(path);
}

/**
 * Get a specific template by ID
 */
export function getTemplate(
  docManager: WikiDocumentManager,
  id: string
): WikiTemplate | undefined {
  return docManager.getTemplate(id);
}
