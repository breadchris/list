"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, FolderTree, Plus, Check, Copy, Link, Sparkles, BookText, ChevronRight, Pencil, Loader2, Archive, ExternalLink, BookOpen } from "lucide-react";
import { WikiSyncStatus, type SyncStatus } from "./wiki-sync-status";
import { useSetAppSettings, useCloseAppSwitcher } from "@/components/AppSettingsContext";
import { useWikiRoomsQuery, useRenameWikiMutation } from "@/hooks/wiki/use-wiki-room-queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { WikiNavMode, WikiRenamePreview, WikiBackup } from "@/types/wiki";

// Format backup date for display
function formatBackupDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

interface WikiSettingsPanelProps {
  /** Wiki ID */
  wikiId: string;
  /** Group ID for fetching other wikis */
  groupId: string;
  /** Wiki display title */
  wikiTitle: string;
  /** Current page path */
  currentPagePath: string;
  /** Current page ID */
  currentPageId?: string;
  /** Current navigation mode */
  navMode: WikiNavMode;
  /** Sync status (offline/syncing/synced) */
  syncStatus: SyncStatus;
  /** Callback to change navigation mode */
  onNavModeChange: (mode: WikiNavMode) => void;
  /** Toggle the page tree sidebar */
  onToggleSidebar: () => void;
  /** Toggle the templates sidebar */
  onToggleTemplatesSidebar: () => void;
  /** Toggle the book picker modal */
  onToggleBookPicker?: () => void;
  /** Create a new page */
  onCreateNewPage: () => void;
  /** Callback when wiki is renamed */
  onWikiRenamed?: (newTitle: string) => void;
  /** Get preview for a page rename */
  getRenamePreview?: (pageId: string, newPath: string) => WikiRenamePreview | null;
  /** Rename a page and all its children, updating all links */
  onRenamePage?: (pageId: string, newPath: string) => { success: boolean; error?: string };
  /** List of backups */
  backups?: WikiBackup[];
  /** Whether backup is being created */
  isCreatingBackup?: boolean;
  /** Create a backup */
  onCreateBackup?: () => void;
}

/**
 * Internal component that renders the settings content.
 * All state lives here to avoid infinite loops from parent useEffect deps.
 */
function WikiSettingsContent({
  propsRef,
}: {
  propsRef: React.MutableRefObject<WikiSettingsPanelProps>;
}) {
  const router = useRouter();
  const closeAppSwitcher = useCloseAppSwitcher();
  const { mutateAsync: renameWiki, isPending: isRenaming } = useRenameWikiMutation();

  // Access props via ref to always get current values
  const props = propsRef.current;
  const { wikiId, groupId, wikiTitle, currentPagePath, currentPageId, navMode, syncStatus, onNavModeChange, onToggleSidebar, onToggleTemplatesSidebar, onToggleBookPicker, onCreateNewPage, onWikiRenamed, getRenamePreview, onRenamePage, backups = [], isCreatingBackup, onCreateBackup } = props;

  const { data: wikis = [], isLoading: wikisLoading } = useWikiRoomsQuery(groupId);
  const [copied, setCopied] = useState(false);
  const [wikiSelectorOpen, setWikiSelectorOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newWikiName, setNewWikiName] = useState(wikiTitle);

  // Page rename state
  const [pageRenameDialogOpen, setPageRenameDialogOpen] = useState(false);
  const [newPagePath, setNewPagePath] = useState(currentPagePath || "index");
  const [renamePreview, setRenamePreview] = useState<WikiRenamePreview | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Sync newWikiName when wikiTitle changes (e.g., after rename)
  useEffect(() => {
    setNewWikiName(wikiTitle);
  }, [wikiTitle]);

  // Sync newPagePath when currentPagePath changes
  useEffect(() => {
    setNewPagePath(currentPagePath || "index");
  }, [currentPagePath]);

  // Update preview when newPagePath changes
  const handlePagePathChange = useCallback((path: string) => {
    setNewPagePath(path);
    setRenameError(null);
    if (currentPageId && getRenamePreview && path.trim() && path !== currentPagePath) {
      const preview = getRenamePreview(currentPageId, path);
      setRenamePreview(preview);
    } else {
      setRenamePreview(null);
    }
  }, [currentPageId, currentPagePath, getRenamePreview]);

  // Handle page rename
  const handlePageRename = useCallback(() => {
    if (!currentPageId || !onRenamePage) return;

    const trimmedPath = newPagePath.trim();
    if (!trimmedPath || trimmedPath === currentPagePath) {
      setPageRenameDialogOpen(false);
      return;
    }

    const result = onRenamePage(currentPageId, trimmedPath);
    if (result.success) {
      setPageRenameDialogOpen(false);
      setRenamePreview(null);
      setRenameError(null);
    } else {
      setRenameError(result.error || "Failed to rename page");
    }
  }, [currentPageId, currentPagePath, newPagePath, onRenamePage]);

  // Public URL for sharing (always accessible via readonly Y.js)
  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/wiki/pub/${wikiId}`
    : `/wiki/pub/${wikiId}`;

  const handleSwitchWiki = useCallback((selectedWikiId: string) => {
    if (selectedWikiId !== wikiId) {
      router.push(`/wiki/${selectedWikiId}`);
    }
    setWikiSelectorOpen(false);
  }, [wikiId, router]);

  const handleRename = useCallback(async () => {
    const trimmedName = newWikiName.trim();
    if (!trimmedName || trimmedName === wikiTitle) {
      setRenameDialogOpen(false);
      return;
    }

    try {
      await renameWiki({ wikiId, newTitle: trimmedName });
      onWikiRenamed?.(trimmedName);
      setRenameDialogOpen(false);
    } catch (error) {
      console.error("Failed to rename wiki:", error);
    }
  }, [wikiId, newWikiName, wikiTitle, renameWiki, onWikiRenamed]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [publicUrl]);

  const handleBrowsePages = useCallback(() => {
    onToggleSidebar();
    closeAppSwitcher();
  }, [onToggleSidebar, closeAppSwitcher]);

  const handleBrowseTemplates = useCallback(() => {
    onToggleTemplatesSidebar();
    closeAppSwitcher();
  }, [onToggleTemplatesSidebar, closeAppSwitcher]);

  const handleOpenBookPicker = useCallback(() => {
    onToggleBookPicker?.();
    closeAppSwitcher();
  }, [onToggleBookPicker, closeAppSwitcher]);

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Wiki selector with rename */}
      <div className="flex items-center gap-2">
        <Dialog open={wikiSelectorOpen} onOpenChange={setWikiSelectorOpen}>
          <DialogTrigger asChild>
            <button className="flex-1 flex items-center justify-between gap-2 px-3 py-2 text-sm bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors text-left min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <BookText className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span className="text-neutral-200 truncate">{wikiTitle}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500 flex-shrink-0" />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-900 border-neutral-800 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-neutral-100">Switch Wiki</DialogTitle>
            </DialogHeader>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {wikisLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
                </div>
              ) : wikis.length === 0 ? (
                <p className="text-neutral-500 text-sm text-center py-4">No wikis available</p>
              ) : (
                wikis.map((wiki) => {
                  const isSelected = wiki.id === wikiId;
                  const title = wiki.metadata?.title || wiki.data || "Untitled Wiki";
                  return (
                    <button
                      key={wiki.id}
                      onClick={() => handleSwitchWiki(wiki.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                        isSelected
                          ? "bg-teal-600 text-teal-100"
                          : "hover:bg-neutral-800 text-neutral-300"
                      }`}
                    >
                      <span className="text-sm truncate">{title}</span>
                      {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Rename wiki button */}
        <Dialog open={renameDialogOpen} onOpenChange={(open) => {
          setRenameDialogOpen(open);
          if (open) setNewWikiName(wikiTitle);
        }}>
          <DialogTrigger asChild>
            <button
              className="p-2 text-neutral-500 hover:text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
              title="Rename wiki"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-900 border-neutral-800 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-neutral-100">Rename Wiki</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <input
                type="text"
                value={newWikiName}
                onChange={(e) => setNewWikiName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setRenameDialogOpen(false);
                }}
                placeholder="Wiki name"
                autoFocus
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setRenameDialogOpen(false)}
                  className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRename}
                  disabled={isRenaming || !newWikiName.trim()}
                  className="px-3 py-1.5 text-sm text-white bg-teal-600 hover:bg-teal-500 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-lg transition-colors"
                >
                  {isRenaming ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current page info with sync status and rename */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-sm text-neutral-300 truncate">
            {currentPagePath || "index"}
          </span>
        </div>
        <WikiSyncStatus status={syncStatus} />

        {/* Rename page button - only show if not index page and handlers are provided */}
        {currentPageId && onRenamePage && currentPagePath !== "index" && (
          <Dialog
            open={pageRenameDialogOpen}
            onOpenChange={(open) => {
              setPageRenameDialogOpen(open);
              if (open) {
                setNewPagePath(currentPagePath || "index");
                setRenamePreview(null);
                setRenameError(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <button
                className="p-1.5 text-neutral-500 hover:text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
                title="Rename page"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 max-w-md">
              <DialogHeader>
                <DialogTitle className="text-neutral-100">Rename Page</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Path input */}
                <div>
                  <label className="text-sm text-neutral-400 mb-1.5 block">New path</label>
                  <input
                    type="text"
                    value={newPagePath}
                    onChange={(e) => handlePagePathChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handlePageRename();
                      if (e.key === "Escape") setPageRenameDialogOpen(false);
                    }}
                    placeholder="page-path"
                    autoFocus
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* Error message */}
                {renameError && (
                  <p className="text-sm text-red-400">{renameError}</p>
                )}

                {/* Preview section */}
                {renamePreview && (
                  <div className="space-y-3 text-sm">
                    {/* Pages to rename */}
                    {renamePreview.pages_to_rename.length > 1 && (
                      <div>
                        <p className="text-neutral-400 mb-1.5">
                          Pages to rename ({renamePreview.pages_to_rename.length}):
                        </p>
                        <ul className="space-y-1 max-h-24 overflow-y-auto bg-neutral-800/50 rounded-lg p-2">
                          {renamePreview.pages_to_rename.map((p) => (
                            <li key={p.old_path} className="flex items-center gap-2 text-xs">
                              <span className="text-neutral-500 truncate">{p.old_path}</span>
                              <span className="text-neutral-600 flex-shrink-0">→</span>
                              <span className="text-teal-400 truncate">{p.new_path}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Affected pages with links */}
                    {renamePreview.affected_pages.length > 0 && (
                      <div>
                        <p className="text-neutral-400 mb-1.5">
                          Links to update ({renamePreview.total_link_updates}):
                        </p>
                        <ul className="space-y-1 max-h-24 overflow-y-auto bg-neutral-800/50 rounded-lg p-2">
                          {renamePreview.affected_pages.map((p) => (
                            <li key={p.path} className="flex items-center justify-between text-xs">
                              <span className="text-neutral-300 truncate">{p.title}</span>
                              <span className="text-neutral-500 flex-shrink-0 ml-2">
                                {p.link_count} {p.link_count === 1 ? "link" : "links"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* No changes info */}
                    {renamePreview.pages_to_rename.length === 1 && renamePreview.affected_pages.length === 0 && (
                      <p className="text-neutral-500 text-xs">
                        No other pages link to this page.
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setPageRenameDialogOpen(false)}
                    className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePageRename}
                    disabled={!newPagePath.trim() || newPagePath === currentPagePath}
                    className="px-3 py-1.5 text-sm text-white bg-teal-600 hover:bg-teal-500 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-lg transition-colors"
                  >
                    Rename
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Browse pages button */}
      <button
        onClick={handleBrowsePages}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
      >
        <FolderTree className="w-4 h-4" />
        <span>Browse Pages</span>
      </button>

      {/* Templates button */}
      <button
        onClick={handleBrowseTemplates}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        <span>Templates</span>
      </button>

      {/* Open Book button */}
      {onToggleBookPicker && (
        <button
          onClick={handleOpenBookPicker}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          <span>Open Book</span>
        </button>
      )}

      {/* New page button */}
      <button
        onClick={onCreateNewPage}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>New Page</span>
      </button>

      {/* Share URL section */}
      <div className="pt-3 border-t border-neutral-800">
        <p className="text-sm text-neutral-400 mb-2">Share URL</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={publicUrl}
            className="flex-1 text-xs bg-neutral-900 text-neutral-300 px-2 py-1.5 rounded border border-neutral-700 truncate"
          />
          <button
            onClick={handleCopyUrl}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
            title="Copy URL"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
            title="Open in new tab"
          >
            <Link className="w-4 h-4" />
          </a>
        </div>
        <p className="text-xs text-neutral-600 mt-1">
          Anyone with this link can view the wiki
        </p>
      </div>

      {/* Navigation mode toggle */}
      <div className="pt-3 border-t border-neutral-800">
        <label className="flex items-center justify-between text-sm cursor-pointer">
          <span className="text-neutral-400">Open links in new panel</span>
          <button
            role="switch"
            aria-checked={navMode === "new-panel"}
            onClick={() =>
              onNavModeChange(
                navMode === "new-panel" ? "replace-with-modifier" : "new-panel"
              )
            }
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              navMode === "new-panel" ? "bg-blue-600" : "bg-neutral-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                navMode === "new-panel" ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
        <p className="text-xs text-neutral-600 mt-1">
          {navMode === "new-panel"
            ? "Clicking links opens new panels"
            : "Hold ⌘/Ctrl to open in new panel"}
        </p>
      </div>

      {/* Backups section */}
      <div className="pt-3 border-t border-neutral-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-neutral-500" />
            <span className="text-sm text-neutral-400">Backups</span>
          </div>
          {onCreateBackup && (
            <button
              onClick={onCreateBackup}
              disabled={isCreatingBackup}
              className="text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
            >
              {isCreatingBackup ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Create"
              )}
            </button>
          )}
        </div>
        {backups.length > 0 ? (
          <ul className="space-y-1 max-h-32 overflow-y-auto bg-neutral-800/50 rounded-lg p-2">
            {backups.slice(0, 10).map((backup) => (
              <li
                key={backup.id}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-neutral-300">
                    {formatBackupDate(backup.metadata?.backup_date || backup.created_at)}
                  </span>
                  <span className="text-neutral-600">
                    ({backup.metadata?.page_count || 0} pages)
                  </span>
                </div>
                <a
                  href={`/wiki/backup/${backup.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-teal-400 hover:text-teal-300 flex-shrink-0 ml-2"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-600">
            No backups yet. Backups are created automatically daily.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Wiki settings panel component.
 * Registers settings content in the app switcher sidebar.
 */
export function WikiSettingsPanel(props: WikiSettingsPanelProps) {
  const setAppSettings = useSetAppSettings();

  // Use ref to store props so the content component always has access to current values
  // without triggering useEffect re-runs
  const propsRef = useRef(props);
  propsRef.current = props;

  // Register content once on mount, unregister on unmount
  // The WikiSettingsContent component manages its own state internally
  useEffect(() => {
    setAppSettings(<WikiSettingsContent propsRef={propsRef} />);
    return () => setAppSettings(null);
  }, [setAppSettings]);

  return null;
}
