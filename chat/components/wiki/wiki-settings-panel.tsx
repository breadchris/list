"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, FolderTree, Plus, Check, Copy, Link, Sparkles, BookText, ChevronRight, Pencil, Loader2 } from "lucide-react";
import { useSetAppSettings, useCloseAppSwitcher } from "@/components/AppSettingsContext";
import { useWikiRoomsQuery, useRenameWikiMutation } from "@/hooks/wiki/use-wiki-room-queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { WikiNavMode } from "@/types/wiki";

interface WikiSettingsPanelProps {
  /** Wiki ID */
  wikiId: string;
  /** Group ID for fetching other wikis */
  groupId: string;
  /** Wiki display title */
  wikiTitle: string;
  /** Current page path */
  currentPagePath: string;
  /** Current navigation mode */
  navMode: WikiNavMode;
  /** Callback to change navigation mode */
  onNavModeChange: (mode: WikiNavMode) => void;
  /** Toggle the page tree sidebar */
  onToggleSidebar: () => void;
  /** Toggle the templates sidebar */
  onToggleTemplatesSidebar: () => void;
  /** Create a new page */
  onCreateNewPage: () => void;
  /** Callback when wiki is renamed */
  onWikiRenamed?: (newTitle: string) => void;
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
  const { wikiId, groupId, wikiTitle, currentPagePath, navMode, onNavModeChange, onToggleSidebar, onToggleTemplatesSidebar, onCreateNewPage, onWikiRenamed } = props;

  const { data: wikis = [], isLoading: wikisLoading } = useWikiRoomsQuery(groupId);
  const [copied, setCopied] = useState(false);
  const [wikiSelectorOpen, setWikiSelectorOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newWikiName, setNewWikiName] = useState(wikiTitle);

  // Sync newWikiName when wikiTitle changes (e.g., after rename)
  useEffect(() => {
    setNewWikiName(wikiTitle);
  }, [wikiTitle]);

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

      {/* Current page info */}
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-blue-400" />
        <span className="text-sm text-neutral-300 truncate">
          {currentPagePath || "index"}
        </span>
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
