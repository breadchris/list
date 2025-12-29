import type { WikiNavItem } from "@/types/wiki";

/**
 * Interface for wiki page data from database
 */
interface WikiPageData {
  id: string;
  data: string;
  metadata: {
    path: string;
    title?: string;
  };
}

/**
 * Transform wiki link elements to public URLs
 *
 * Wiki links in BlockNote are rendered as spans with data attributes.
 * This function converts them to anchor tags pointing to public wiki URLs.
 *
 * @param html - HTML string with wiki link spans
 * @param wikiId - Wiki ID for URL construction
 * @returns HTML with transformed links
 */
export function transformWikiLinks(html: string, wikiId: string): string {
  // Match wiki link inline content rendered as span
  // BlockNote renders custom inline content with data-content-type attribute
  const wikiLinkPattern = /<span[^>]*data-content-type="wikiLink"[^>]*>([^<]*)<\/span>/g;

  html = html.replace(wikiLinkPattern, (match, text) => {
    // Extract page_path from data attribute if present
    const pathMatch = match.match(/data-page_path="([^"]*)"/);
    const path = pathMatch ? pathMatch[1] : text.toLowerCase().replace(/\s+/g, "-");

    return `<a href="/wiki/pub/${wikiId}/${path}" class="wiki-link text-blue-400 hover:text-blue-300 hover:underline">${escapeHtml(text)}</a>`;
  });

  // Also handle any [[wiki link]] text that wasn't converted to inline content
  const bracketLinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  html = html.replace(bracketLinkPattern, (_, target, display) => {
    const path = target.trim().toLowerCase().replace(/\s+/g, "-");
    const text = display?.trim() || target.trim();
    return `<a href="/wiki/pub/${wikiId}/${path}" class="wiki-link text-blue-400 hover:text-blue-300 hover:underline">${escapeHtml(text)}</a>`;
  });

  return html;
}

/**
 * Build navigation tree from flat list of wiki pages
 *
 * @param pages - Array of wiki page data
 * @returns Hierarchical navigation tree
 */
export function buildNavTree(pages: WikiPageData[]): WikiNavItem[] {
  // Sort pages by path for consistent ordering
  const sortedPages = [...pages].sort((a, b) =>
    (a.metadata.path || "").localeCompare(b.metadata.path || "")
  );

  const root: WikiNavItem[] = [];
  const nodeMap = new Map<string, WikiNavItem>();

  for (const page of sortedPages) {
    const path = page.metadata.path || "index";
    const title = page.metadata.title || pathToTitle(path);

    const node: WikiNavItem = {
      path,
      title,
      children: [],
    };

    nodeMap.set(path, node);

    // Find parent path
    const pathParts = path.split("/");
    if (pathParts.length > 1) {
      const parentPath = pathParts.slice(0, -1).join("/");
      const parent = nodeMap.get(parentPath);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
        continue;
      }
    }

    // No parent found, add to root
    root.push(node);
  }

  return root;
}

/**
 * Convert path to human-readable title
 *
 * @param path - Wiki page path
 * @returns Human-readable title
 */
function pathToTitle(path: string): string {
  // Get last segment of path
  const segments = path.split("/");
  const lastSegment = segments[segments.length - 1];

  // Convert kebab-case/snake_case to Title Case
  return lastSegment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}
