/**
 * Link parsing utilities for wiki content
 * Supports both [[wiki links]] and standard [markdown](links)
 */

import type { ParsedLink, WikiLinkType } from "@/types/wiki";
import { isExternalUrl, normalizePath } from "./path-utils";

/**
 * Regex patterns for link detection
 */
const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Parse a wiki-style link [[target]] or [[target|display text]]
 * @param match The regex match
 * @returns ParsedLink or null if invalid
 */
export function parseWikiLink(linkText: string): ParsedLink | null {
  // Remove [[ and ]]
  const inner = linkText.replace(/^\[\[|\]\]$/g, "");

  if (!inner) {
    return null;
  }

  // Check for display text with pipe separator
  const pipeIndex = inner.indexOf("|");

  if (pipeIndex !== -1) {
    const target = inner.substring(0, pipeIndex).trim();
    const text = inner.substring(pipeIndex + 1).trim();

    return {
      type: "wiki",
      target: normalizePath(target),
      text: text || target,
    };
  }

  const target = inner.trim();

  return {
    type: "wiki",
    target: normalizePath(target),
    text: target,
  };
}

/**
 * Parse a markdown-style link [text](url)
 * @param text The display text
 * @param url The URL/path
 * @returns ParsedLink
 */
export function parseMarkdownLink(text: string, url: string): ParsedLink {
  const isExternal = isExternalUrl(url);

  return {
    type: isExternal ? "external" : "markdown",
    target: isExternal ? url : normalizePath(url),
    text,
  };
}

/**
 * Extract all links from wiki content (markdown string)
 * @param content The markdown content
 * @returns Array of parsed links
 */
export function extractLinks(content: string): ParsedLink[] {
  const links: ParsedLink[] = [];

  // Extract wiki links [[target]] or [[target|text]]
  let match: RegExpExecArray | null;

  // Reset regex state
  WIKI_LINK_PATTERN.lastIndex = 0;
  while ((match = WIKI_LINK_PATTERN.exec(content)) !== null) {
    const target = match[1].trim();
    const displayText = match[2]?.trim();

    links.push({
      type: "wiki",
      target: normalizePath(target),
      text: displayText || target,
    });
  }

  // Extract markdown links [text](url)
  MARKDOWN_LINK_PATTERN.lastIndex = 0;
  while ((match = MARKDOWN_LINK_PATTERN.exec(content)) !== null) {
    const text = match[1];
    const url = match[2];
    const isExternal = isExternalUrl(url);

    links.push({
      type: isExternal ? "external" : "markdown",
      target: isExternal ? url : normalizePath(url),
      text,
    });
  }

  return links;
}

/**
 * Extract only internal wiki/markdown links (not external URLs)
 * @param content The markdown content
 * @returns Array of internal links
 */
export function extractInternalLinks(content: string): ParsedLink[] {
  return extractLinks(content).filter((link) => link.type !== "external");
}

/**
 * Check if a string contains wiki link syntax
 */
export function hasWikiLinks(content: string): boolean {
  WIKI_LINK_PATTERN.lastIndex = 0;
  return WIKI_LINK_PATTERN.test(content);
}

/**
 * Convert wiki links in content to markdown links
 * Useful for export or rendering in non-wiki contexts
 * @param content The content with wiki links
 * @param pathPrefix Optional prefix for paths
 */
export function wikiLinksToMarkdown(
  content: string,
  pathPrefix: string = ""
): string {
  WIKI_LINK_PATTERN.lastIndex = 0;
  return content.replace(WIKI_LINK_PATTERN, (_, target, displayText) => {
    const text = displayText?.trim() || target.trim();
    const path = normalizePath(target.trim());
    return `[${text}](${pathPrefix}${path})`;
  });
}

/**
 * Convert markdown links to wiki links
 * Only converts internal links, not external URLs
 * @param content The content with markdown links
 */
export function markdownLinksToWiki(content: string): string {
  MARKDOWN_LINK_PATTERN.lastIndex = 0;
  return content.replace(MARKDOWN_LINK_PATTERN, (match, text, url) => {
    if (isExternalUrl(url)) {
      return match; // Keep external links as-is
    }

    const path = normalizePath(url);
    if (text === path) {
      return `[[${path}]]`;
    }
    return `[[${path}|${text}]]`;
  });
}

/**
 * Create a wiki link string
 * @param target The target page path
 * @param displayText Optional display text (if different from target)
 */
export function createWikiLink(target: string, displayText?: string): string {
  const normalizedTarget = normalizePath(target);

  if (displayText && displayText !== normalizedTarget) {
    return `[[${normalizedTarget}|${displayText}]]`;
  }

  return `[[${normalizedTarget}]]`;
}

/**
 * Create a markdown link string
 * @param text The display text
 * @param url The URL or path
 */
export function createMarkdownLink(text: string, url: string): string {
  return `[${text}](${url})`;
}

/**
 * Determine the type of a link string
 */
export function getLinkType(linkString: string): WikiLinkType | null {
  if (linkString.startsWith("[[") && linkString.endsWith("]]")) {
    return "wiki";
  }

  const markdownMatch = linkString.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (markdownMatch) {
    return isExternalUrl(markdownMatch[2]) ? "external" : "markdown";
  }

  if (isExternalUrl(linkString)) {
    return "external";
  }

  return null;
}

/**
 * Update all links to a renamed page
 * @param content The content to update
 * @param oldPath The old page path
 * @param newPath The new page path
 */
export function updateLinksForRename(
  content: string,
  oldPath: string,
  newPath: string
): string {
  const normalizedOld = normalizePath(oldPath);
  const normalizedNew = normalizePath(newPath);

  // Update wiki links
  let updated = content.replace(WIKI_LINK_PATTERN, (match, target, display) => {
    if (normalizePath(target.trim()) === normalizedOld) {
      const text = display?.trim();
      if (text) {
        return `[[${normalizedNew}|${text}]]`;
      }
      return `[[${normalizedNew}]]`;
    }
    return match;
  });

  // Update markdown links
  updated = updated.replace(MARKDOWN_LINK_PATTERN, (match, text, url) => {
    if (!isExternalUrl(url) && normalizePath(url) === normalizedOld) {
      return `[${text}](${normalizedNew})`;
    }
    return match;
  });

  return updated;
}

/**
 * Find all pages that link to a given page
 * @param pages Map of page path to content
 * @param targetPath The page path to find backlinks for
 * @returns Array of page paths that link to the target
 */
export function findBacklinks(
  pages: Map<string, string>,
  targetPath: string
): string[] {
  const normalizedTarget = normalizePath(targetPath);
  const backlinks: string[] = [];

  for (const [pagePath, content] of pages) {
    const links = extractInternalLinks(content);
    const linksToTarget = links.some(
      (link) => link.target === normalizedTarget
    );

    if (linksToTarget) {
      backlinks.push(pagePath);
    }
  }

  return backlinks;
}
