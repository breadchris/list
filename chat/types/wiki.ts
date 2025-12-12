/**
 * Types for Wiki Builder
 * A multi-panel wiki interface with path-based page organization
 */

/**
 * Navigation mode for wiki links
 * - "new-panel": Always open links in a new panel to the right
 * - "replace-with-modifier": Click replaces current panel, Cmd/Ctrl+Click opens new panel
 */
export type WikiNavMode = "new-panel" | "replace-with-modifier";

/**
 * User settings for the wiki interface
 */
export interface WikiSettings {
  nav_mode: WikiNavMode;
}

/**
 * A wiki document (the root container for wiki pages)
 * Stored in content table with type: "wiki"
 */
export interface Wiki {
  id: string;
  name: string;
  group_id: string;
  created_at: string;
  updated_at: string;
  settings?: WikiSettings;
}

/**
 * A single wiki page
 * Stored in content table with type: "wiki-page"
 */
export interface WikiPage {
  id: string;
  /** Path relative to wiki root, e.g., "index", "guide/getting-started" */
  path: string;
  /** Title extracted from first heading or path */
  title: string;
  /** Parent wiki content ID */
  wiki_id: string;
  /** Content (markdown or BlockNote blocks) */
  data: string;
  created_at: string;
  updated_at: string;
}

/**
 * Metadata stored in content.metadata for wiki pages
 */
export interface WikiPageMetadata {
  /** Relative path within the wiki */
  path: string;
  /** Page title */
  title?: string;
  /** Parent wiki ID (redundant with parent_content_id but useful for queries) */
  wiki_id?: string;
}

/**
 * Metadata stored in content.metadata for wiki root
 */
export interface WikiMetadata {
  /** Wiki display name */
  name: string;
  /** User settings */
  settings?: WikiSettings;
}

/**
 * An open panel in the wiki interface
 */
export interface WikiPanel {
  /** Unique panel ID */
  id: string;
  /** Page path, e.g., "index", "guide/intro" */
  page_path: string;
  /** Content table ID for this page */
  page_id: string;
  /** Whether this panel is the active/focused one */
  is_active?: boolean;
}

/**
 * Link types supported in wiki editor
 */
export type WikiLinkType = "wiki" | "markdown" | "external";

/**
 * A parsed link from wiki content
 */
export interface ParsedLink {
  /** Type of link */
  type: WikiLinkType;
  /** Display text */
  text: string;
  /** Target path or URL */
  target: string;
  /** Whether the target page exists (for wiki links) */
  exists?: boolean;
}

/**
 * Context for wiki navigation
 */
export interface WikiNavContext {
  /** Current wiki ID */
  wiki_id: string;
  /** Open panels */
  panels: WikiPanel[];
  /** Currently active panel index */
  active_panel_index: number;
  /** Navigation mode setting */
  nav_mode: WikiNavMode;
}

/**
 * Page tree node for sidebar navigation
 */
export interface WikiPageTreeNode {
  /** Page path */
  path: string;
  /** Page title */
  title: string;
  /** Content ID */
  id: string;
  /** Child nodes (for folder structure) */
  children: WikiPageTreeNode[];
  /** Whether this node is expanded in the tree */
  is_expanded?: boolean;
}

/**
 * Props for BlockNote wiki link inline content
 */
export interface WikiLinkProps {
  /** Target page path */
  page_path: string;
  /** Whether the target page exists */
  exists?: boolean;
}

/**
 * Event emitted when a wiki link is clicked
 */
export interface WikiLinkClickEvent {
  /** Target page path */
  path: string;
  /** Original mouse event for modifier key detection */
  mouse_event: MouseEvent;
  /** Source panel ID */
  source_panel_id: string;
}

/**
 * State for the wiki editor component
 */
export interface WikiEditorState {
  /** Whether the editor is loading */
  is_loading: boolean;
  /** Whether there are unsaved changes */
  is_dirty: boolean;
  /** Last saved timestamp */
  last_saved?: string;
  /** Current collaborators */
  collaborators: WikiCollaborator[];
}

/**
 * A collaborator in the wiki editor
 */
export interface WikiCollaborator {
  /** User ID */
  user_id: string;
  /** Display name */
  name: string;
  /** Avatar color */
  color: string;
  /** Cursor position if available */
  cursor_position?: number;
}

/**
 * Default wiki settings
 */
export const DEFAULT_WIKI_SETTINGS: WikiSettings = {
  nav_mode: "new-panel",
};

/**
 * Content types for wiki storage
 */
export const WIKI_CONTENT_TYPE = "wiki" as const;
export const WIKI_PAGE_CONTENT_TYPE = "wiki-page" as const;
