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
 * Base properties shared by all panel types
 */
interface WikiPanelBase {
  /** Unique panel ID */
  id: string;
  /** Whether this panel is the active/focused one */
  is_active?: boolean;
  /** Whether this panel is collapsed to the dock */
  collapsed?: boolean;
  /** Whether this panel's content is selected for AI context */
  selected_for_ai_context?: boolean;
}

/**
 * A wiki page panel (the default panel type)
 */
export interface WikiPagePanel extends WikiPanelBase {
  /** Panel type - optional for backwards compatibility with existing panels */
  type?: "page";
  /** Page path, e.g., "index", "guide/intro" */
  page_path: string;
  /** Content table ID for this page */
  page_id: string;
}

/**
 * A reader panel for displaying EPUB books
 */
export interface WikiReaderPanel extends WikiPanelBase {
  /** Panel type - required for reader panels */
  type: "reader";
  /** Content ID of the book to display */
  book_content_id: string;
  /** Book title for display in panel header */
  book_title?: string;
}

/**
 * An open panel in the wiki interface
 * Can be either a page panel or a reader panel
 */
export type WikiPanel = WikiPagePanel | WikiReaderPanel;

/**
 * Type guard to check if a panel is a reader panel
 */
export function isReaderPanel(panel: WikiPanel): panel is WikiReaderPanel {
  return panel.type === "reader";
}

/**
 * Type guard to check if a panel is a page panel
 */
export function isPagePanel(panel: WikiPanel): panel is WikiPagePanel {
  return panel.type !== "reader";
}

/**
 * Layout state for wiki collapse/focus persistence
 */
export interface WikiLayoutState {
  /** IDs of collapsed panels */
  collapsed_panel_ids: string[];
  /** ID of panel in focus mode (null = normal mode) */
  focused_panel_id: string | null;
  /** Panel page_paths in display order (for persistence) */
  panel_order_paths?: string[];
  /** Page paths selected for AI context */
  ai_context_selected_paths?: string[];
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
export const WIKI_BACKUP_CONTENT_TYPE = "wiki-backup" as const;

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
  /** Whether to include selected text as {{selection}} variable */
  include_selection?: boolean;
  /** ISO timestamp when template was created */
  created_at: string;
}

/**
 * Available AI models for wiki templates and AI scratch
 */
export const WIKI_TEMPLATE_MODELS = [
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'OpenAI' },
] as const;

/**
 * Default AI model for new templates
 */
export const DEFAULT_TEMPLATE_MODEL = 'gpt-4.1';

/**
 * An AI scratch session stored in Y.js
 */
export interface WikiAIScratch {
  /** Local UUID */
  id: string;
  /** Parent wiki content ID */
  wiki_id: string;
  /** AI model to use */
  model: string;
  /** ISO timestamp when created */
  created_at: string;
}

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

/**
 * Presence state for wiki viewers
 * Broadcast via Y.js Awareness
 */
export interface WikiPresenceState {
  /** Stable visitor ID (from localStorage) */
  visitor_id: string;
  /** Display name (Anonymous 1, Anonymous 2, etc.) */
  display_name: string;
  /** Unique color for this visitor (HSL format) */
  color: string;
  /** Current page path being viewed */
  current_page_path: string;
  /** Mouse cursor position relative to viewport (null when not hovering editor) */
  cursor_position: { x: number; y: number } | null;
  /** Last activity timestamp (for idle detection) */
  last_active: number;
}

/**
 * Processed presence user for UI rendering
 */
export interface WikiPresenceUser {
  /** Y.js client ID */
  client_id: number;
  /** Stable visitor ID */
  visitor_id: string;
  /** Display name */
  display_name: string;
  /** Assigned color */
  color: string;
  /** Current page */
  current_page_path: string;
  /** Cursor position (null if not on same page or not hovering) */
  cursor_position: { x: number; y: number } | null;
  /** Whether user is active (not idle) */
  is_active: boolean;
}

/**
 * Preview information for a page rename operation
 */
export interface WikiRenamePreview {
  /** Pages that will be renamed (this page + children) */
  pages_to_rename: Array<{
    old_path: string;
    new_path: string;
    title: string;
  }>;
  /** Pages that contain links to any of the pages being renamed */
  affected_pages: Array<{
    path: string;
    title: string;
    link_count: number;
  }>;
  /** Total number of links that will be updated */
  total_link_updates: number;
}

/**
 * Metadata stored in content.metadata for wiki backups
 */
export interface WikiBackupMetadata {
  /** Wiki ID this backup belongs to */
  wiki_id: string;
  /** Wiki title at backup time */
  wiki_title: string;
  /** ISO date string (YYYY-MM-DD) for daily deduplication */
  backup_date: string;
  /** Total number of pages backed up */
  page_count: number;
  /** Created by username */
  created_by_username?: string;
  /** Manual vs auto backup */
  trigger: "manual" | "auto";
}

/**
 * A single page within a wiki backup
 */
export interface WikiBackupPage {
  /** Page path (e.g., "index", "guide/intro") */
  path: string;
  /** Page title */
  title: string;
  /** Full HTML content */
  html: string;
  /** Markdown content */
  markdown: string;
}

/**
 * Data stored in content.data for wiki backups
 */
export interface WikiBackupData {
  pages: WikiBackupPage[];
}

/**
 * A wiki backup entry from the database
 */
export interface WikiBackup {
  id: string;
  created_at: string;
  metadata: WikiBackupMetadata;
}
