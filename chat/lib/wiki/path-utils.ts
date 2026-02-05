/**
 * Path utilities for wiki page navigation
 */

/**
 * Normalize a wiki path by removing leading/trailing slashes and handling special cases
 */
export function normalizePath(path: string): string {
  // Remove leading and trailing slashes and whitespace
  let normalized = path.trim().replace(/^\/+|\/+$/g, "");

  // Handle empty path as index
  if (!normalized || normalized === ".") {
    return "index";
  }

  // Collapse multiple slashes
  normalized = normalized.replace(/\/+/g, "/");

  // Remove .md extension if present
  normalized = normalized.replace(/\.md$/, "");

  return normalized;
}

/**
 * Resolve a relative path from a base path
 * @param basePath The current page path (e.g., "guide/intro")
 * @param relativePath The link target (e.g., "../getting-started" or "advanced/setup")
 */
export function resolvePath(basePath: string, relativePath: string): string {
  // If it starts with /, it's absolute from wiki root
  if (relativePath.startsWith("/")) {
    return normalizePath(relativePath);
  }

  // Get the directory of the base path
  const baseDir = getParentPath(basePath);

  // Handle relative navigation
  const parts = relativePath.split("/");
  const baseParts = baseDir ? baseDir.split("/") : [];

  for (const part of parts) {
    if (part === "..") {
      baseParts.pop();
    } else if (part !== "." && part !== "") {
      baseParts.push(part);
    }
  }

  return normalizePath(baseParts.join("/"));
}

/**
 * Get the parent directory path
 * @param path The page path
 * @returns Parent path or empty string if at root
 */
export function getParentPath(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf("/");

  if (lastSlash === -1) {
    return "";
  }

  return normalized.substring(0, lastSlash);
}

/**
 * Get the page name from a path
 * @param path The page path
 * @returns The final segment of the path
 */
export function getPageName(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf("/");

  if (lastSlash === -1) {
    return normalized;
  }

  return normalized.substring(lastSlash + 1);
}

/**
 * Convert a path to a display title
 * @param path The page path
 * @returns Human-readable title
 */
export function pathToTitle(path: string): string {
  const name = getPageName(path);

  // Handle index specially
  if (name === "index") {
    return "Home";
  }

  // Convert kebab-case and snake_case to Title Case
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Convert a title to a path-safe slug
 * @param title The page title
 * @returns URL-safe path segment
 */
export function titleToPath(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Check if a path is the index/home page
 */
export function isIndexPath(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized === "index" || normalized === "";
}

/**
 * Check if a path is a child of another path
 * @param parentPath The potential parent path
 * @param childPath The potential child path
 */
export function isChildPath(parentPath: string, childPath: string): boolean {
  const normalizedParent = normalizePath(parentPath);
  const normalizedChild = normalizePath(childPath);

  if (normalizedParent === "") {
    // Root is parent of everything except index
    return normalizedChild !== "index" && !normalizedChild.includes("/");
  }

  return normalizedChild.startsWith(normalizedParent + "/");
}

/**
 * Get all ancestor paths for a given path
 * @param path The page path
 * @returns Array of ancestor paths from root to immediate parent
 */
export function getAncestorPaths(path: string): string[] {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  const ancestors: string[] = [];

  // Build up ancestor paths
  for (let i = 0; i < parts.length - 1; i++) {
    ancestors.push(parts.slice(0, i + 1).join("/"));
  }

  return ancestors;
}

/**
 * Get the depth of a path (number of segments)
 * @param path The page path
 * @returns Depth (0 for index, 1 for top-level pages, etc.)
 */
export function getPathDepth(path: string): number {
  const normalized = normalizePath(path);

  if (normalized === "index") {
    return 0;
  }

  return normalized.split("/").length;
}

/**
 * Check if a string looks like an external URL
 */
export function isExternalUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:|tel:)/i.test(url);
}

/**
 * Check if a path is valid (no invalid characters)
 */
export function isValidPath(path: string): boolean {
  // Allow alphanumeric, hyphens, underscores, and slashes
  return /^[a-zA-Z0-9\-_\/]+$/.test(path);
}

/**
 * Sanitize a path by removing invalid characters
 */
export function sanitizePath(path: string): string {
  return path
    .replace(/[^a-zA-Z0-9\-_\/\s]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/**
 * Format a date as YYYY-MM-DD for daily note paths
 */
export function formatDatePath(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

/**
 * Get today's daily note path
 */
export function getTodayPath(): string {
  return `daily/${formatDatePath(new Date())}`;
}

/**
 * Get yesterday's daily note path
 */
export function getYesterdayPath(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return `daily/${formatDatePath(yesterday)}`;
}
