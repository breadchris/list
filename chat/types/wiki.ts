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
 * A single wiki page stored in Y.js
 * Content is stored in Y.XmlFragment, metadata in Y.Map
 */
export interface WikiPage {
  /** Local UUID generated with crypto.randomUUID() */
  id: string;
  /** Path relative to wiki root, e.g., "index", "guide/getting-started" */
  path: string;
  /** Title extracted from first heading or path */
  title: string;
  /** Parent wiki content ID */
  wiki_id: string;
  /** ISO timestamp when page was created */
  created_at: string;
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
  title?: string;
  /** Creator username */
  created_by_username?: string;
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
export const WIKI_TEMPLATE_CONTENT_TYPE = "wiki-template" as const;

/**
 * A wiki template (AI prompt/command)
 * Stored in Y.js Y.Map
 */
export interface WikiTemplate {
  /** Local UUID generated with crypto.randomUUID() */
  id: string;
  /** Template name (displayed in slash menu) */
  name: string;
  /** Parent wiki content ID */
  wiki_id: string;
  /** Template prompt/instructions (BlockNote blocks JSON when prompt_format is 'blocknote') */
  prompt: string;
  /** Format of the prompt field: 'text' for legacy plain text, 'blocknote' for BlockNote blocks JSON */
  prompt_format?: 'text' | 'blocknote';
  /** AI model to use for this template */
  model?: string;
  /** Optional description for subtext in slash menu */
  description?: string;
  /** Aliases for slash command matching */
  aliases?: string[];
  /** ISO timestamp when template was created */
  created_at: string;
}

/**
 * Available AI models for wiki templates
 */
export const WIKI_TEMPLATE_MODELS = [
  { id: 'gpt-5', name: 'GPT-5', provider: 'OpenAI' },
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
] as const;

/**
 * Default AI model for new templates
 */
export const DEFAULT_TEMPLATE_MODEL = 'gpt-5';

/**
 * Metadata stored in content.metadata for wiki templates
 */
export interface WikiTemplateMetadata {
  /** Template display name */
  name: string;
  /** Optional description */
  description?: string;
  /** Aliases for slash command matching */
  aliases?: string[];
  /** Parent wiki ID */
  wiki_id?: string;
}

/**
 * Navigation item for public wiki viewer sidebar
 * Simpler than WikiPageTreeNode - no id or expansion state
 */
export interface WikiNavItem {
  /** Page path */
  path: string;
  /** Page title */
  title: string;
  /** Child navigation items */
  children?: WikiNavItem[];
}
