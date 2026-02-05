"use client";

import { useState, useCallback, useEffect, useRef, createContext, useContext, useMemo } from "react";
import { YDocProvider } from "@y-sweet/react";
import { useSwipeable } from "react-swipeable";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { WikiPanel } from "./wiki-panel";
import { WikiReaderPanel } from "./wiki-reader-panel";
import { BookPickerModal } from "./book-picker-modal";
import { WikiDock } from "./wiki-dock";
import { WikiSidebar } from "./wiki-sidebar";
import { WikiTemplatesSidebar } from "./wiki-templates-sidebar";
import { WikiTemplatePanel } from "./wiki-template-panel";
import { WikiAIScratchPanel } from "./wiki-ai-scratch-panel";
import { WikiSettingsPanel } from "./wiki-settings-panel";
import { useWikiSyncStatus } from "./wiki-sync-status";
import { useWikiNav } from "@/hooks/wiki/use-wiki-nav";
import { useWikiPages } from "@/hooks/wiki/use-wiki-pages";
import { useWikiTemplates } from "@/hooks/wiki/use-wiki-templates";
import { useWikiRoomQuery } from "@/hooks/wiki/use-wiki-room-queries";
import { useWikiAIScratch as useWikiAIScratchHook } from "@/hooks/wiki/use-wiki-ai-scratch";
import { useWikiLayoutPersistence, loadSavedPanelPaths } from "@/hooks/wiki/use-wiki-layout-persistence";
import type { WikiLinkClickEvent, WikiPage, WikiTemplate, WikiReaderPanel as WikiReaderPanelType } from "@/types/wiki";
import { isReaderPanel, isPagePanel } from "@/types/wiki";
import type { GroupBook } from "@/hooks/reader/useGroupBooks";
import type { BlockNoteEditor } from "@blocknote/core";
import { useWikiBackup } from "@/hooks/wiki/use-wiki-backup";

// Context to store editor references for serialization during publish
interface WikiEditorRegistry {
  registerEditor: (pageId: string, editor: BlockNoteEditor<any, any, any>) => void;
  unregisterEditor: (pageId: string) => void;
  getSerializedContent: () => Promise<Map<string, string>>;
}

const WikiEditorRegistryContext = createContext<WikiEditorRegistry | null>(null);

export function useWikiEditorRegistry() {
  return useContext(WikiEditorRegistryContext);
}

// Context to provide AI context from selected panels
interface WikiAIContext {
  /** Get markdown content from all selected-for-AI-context panels */
  getSelectedAIContextMarkdown: () => Promise<string>;
}

const WikiAIContextContext = createContext<WikiAIContext | null>(null);

export function useWikiAIContext() {
  return useContext(WikiAIContextContext);
}

// Context to open AI scratch panel from WikiEditor
interface WikiAIScratchContext {
  openAIScratchPanel: (selectedText?: string) => void;
}

const WikiAIScratchContext = createContext<WikiAIScratchContext | null>(null);

export function useWikiAIScratch() {
  return useContext(WikiAIScratchContext);
}

interface WikiInterfaceProps {
  /** The wiki ID (content table ID for the wiki root) */
  wikiId: string;
  /** The group ID */
  groupId: string;
  /** Y-Sweet connection URL */
  ySweetUrl: string;
  /** Initial page path to open */
  initialPagePath?: string;
}

/**
 * Main wiki interface component
 *
 * Provides:
 * - Multi-panel horizontal layout (like chat threads)
 * - Sidebar for page tree navigation
 * - Real-time collaboration via Y.js
 * - Settings panel for navigation mode
 */
export function WikiInterface({
  wikiId,
  groupId,
  ySweetUrl,
  initialPagePath = "index",
}: WikiInterfaceProps) {
  // Auth function that returns null on failure to enable offline-only mode
  const getClientToken = useCallback(async () => {
    try {
      const response = await fetch("/api/y-sweet-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: `wiki-${wikiId}` }),
      });
      if (!response.ok) {
        console.warn("[Wiki] Y-Sweet auth failed, using offline mode");
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn("[Wiki] Y-Sweet auth error, using offline mode:", error);
      return null;
    }
  }, [wikiId]);

  return (
    <YDocProvider
      docId={`wiki-${wikiId}`}
      authEndpoint={getClientToken}
      offlineSupport={true}
    >
      <WikiInterfaceInner
        wikiId={wikiId}
        groupId={groupId}
        initialPagePath={initialPagePath}
      />
    </YDocProvider>
  );
}

interface WikiInterfaceInnerProps {
  wikiId: string;
  groupId: string;
  initialPagePath: string;
}

function WikiInterfaceInner({
  wikiId,
  groupId,
  initialPagePath,
}: WikiInterfaceInnerProps) {
  // Editor registry for serialization during publish
  const editorsRef = useRef<Map<string, BlockNoteEditor<any, any, any>>>(new Map());

  // Memoize the registry object to prevent unnecessary re-renders and saves
  const editorRegistry: WikiEditorRegistry = useMemo(() => ({
    registerEditor: (pageId: string, editor: BlockNoteEditor<any, any, any>) => {
      editorsRef.current.set(pageId, editor);
    },
    unregisterEditor: (pageId: string) => {
      editorsRef.current.delete(pageId);
    },
    getSerializedContent: async () => {
      const serialized = new Map<string, string>();
      for (const [pageId, editor] of editorsRef.current) {
        try {
          const blocks = editor.document;
          serialized.set(pageId, JSON.stringify(blocks));
        } catch (err) {
          console.error(`Failed to serialize page ${pageId}:`, err);
        }
      }
      return serialized;
    },
  }), []);

  // Sync status (must be inside YDocProvider)
  const syncStatus = useWikiSyncStatus();

  // Sidebar visibility
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTemplatesSidebar, setShowTemplatesSidebar] = useState(false);

  // Template panels state
  const [templatePanels, setTemplatePanels] = useState<WikiTemplate[]>([]);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(-1);
  const [templatePanelWidths, setTemplatePanelWidths] = useState<number[]>([]);

  // Book picker modal state
  const [showBookPicker, setShowBookPicker] = useState(false);

  // AI Scratch panels state (persisted in Y.js)
  const {
    scratchesList: aiScratchPanels,
    isReady: scratchesReady,
    createScratch,
    updateScratch,
    deleteScratch,
  } = useWikiAIScratchHook({ wiki_id: wikiId });
  const [activeAIScratchIndex, setActiveAIScratchIndex] = useState(-1);
  const [aiScratchPanelWidths, setAIScratchPanelWidths] = useState<number[]>([]);
  // Store initial selected text for new scratch panels
  const [aiScratchInitialSelections, setAIScratchInitialSelections] = useState<Map<string, string>>(new Map());

  // Panel widths (desktop)
  const [panelWidths, setPanelWidths] = useState<number[]>([]);

  // Container ref for horizontal scroll
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if desktop
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Wiki pages management (all state in Y.js)
  const {
    pages,
    pageTree,
    isReady: pagesReady,
    getPage,
    getPageById,
    createPage,
    deletePage,
    pageExists,
    renamePageWithChildren,
    getRenamePreview,
  } = useWikiPages({ wiki_id: wikiId });

  // Wiki templates management (all state in Y.js)
  const {
    templates,
    templatesList,
    isReady: templatesReady,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    templateExists,
  } = useWikiTemplates({ wiki_id: wikiId });

  // Wiki room metadata (for title)
  const { data: wikiRoom } = useWikiRoomQuery(wikiId);
  const wikiTitle = wikiRoom?.metadata?.title || getPage("index")?.title || "Wiki";

  // Find initial page ID
  const initialPage = getPage(initialPagePath);

  // Navigation state
  const {
    panels,
    active_panel_index,
    nav_mode,
    openPage,
    replacePage,
    handleLinkClick,
    closePanel,
    setActivePanel,
    setNavMode,
    goBack,
    canGoBack,
    collapsePanel,
    restorePanel,
    enterFocusMode,
    exitFocusMode,
    focused_panel_id,
    isFocusMode,
    reorderPanels,
    setPanelOrder,
    toggleAIContextSelection,
    applyAIContextSelections,
    openMultiplePanels,
    openBook,
  } = useWikiNav({
    wiki_id: wikiId,
    initial_page_id: initialPage?.id,
    initial_page_path: initialPagePath,
  });

  // Persist layout state (collapsed panels, focus mode, panel order, AI context selections)
  useWikiLayoutPersistence({
    wikiId,
    panels,
    focusedPanelId: focused_panel_id,
    restorePanel,
    collapsePanel,
    enterFocusMode,
    setPanelOrder,
    applyAIContextSelections,
  });

  // Wiki backup management
  // Uses Y.js mode - Lambda connects to Y-Sweet directly and reads pages
  const {
    backups,
    hasTodayBackup,
    isCreating: isCreatingBackup,
    createBackup,
  } = useWikiBackup({
    wiki_id: wikiId,
    group_id: groupId,
    wiki_title: wikiTitle,
  });

  // Auto-backup on wiki open (once per session, if no backup exists for today)
  const autoBackupTriggeredRef = useRef(false);
  useEffect(() => {
    // Lambda reads pages directly from Y.js, so we just need Y.js to be ready
    if (pagesReady && !hasTodayBackup && !autoBackupTriggeredRef.current) {
      autoBackupTriggeredRef.current = true;
      // Defer to avoid blocking initial render
      const timer = setTimeout(() => {
        createBackup("auto").catch((err) =>
          console.error("[WikiBackup] Auto-backup failed:", err)
        );
      }, 3000); // Wait 3 seconds for Y.js sync
      return () => clearTimeout(timer);
    }
  }, [pagesReady, hasTodayBackup, createBackup]);

  // Manual backup handler
  const handleCreateBackup = useCallback(() => {
    createBackup("manual");
  }, [createBackup]);

  // Store refs for AI context (avoids stale closures in memoized callback)
  const panelsRef = useRef(panels);
  useEffect(() => {
    panelsRef.current = panels;
  }, [panels]);

  const getPageByIdRef = useRef(getPageById);
  useEffect(() => {
    getPageByIdRef.current = getPageById;
  }, [getPageById]);

  // Memoize the AI context object
  const wikiAIContext: WikiAIContext = useMemo(() => ({
    getSelectedAIContextMarkdown: async () => {
      const currentPanels = panelsRef.current;
      const selectedPanels = currentPanels.filter(p => p.selected_for_ai_context);

      if (selectedPanels.length === 0) {
        return "";
      }

      const contextParts: string[] = [];

      for (const panel of selectedPanels) {
        // Only page panels have content for AI context
        if (!isPagePanel(panel)) continue;

        const editor = editorsRef.current.get(panel.page_id);
        if (!editor) continue;

        const page = getPageByIdRef.current(panel.page_id);
        const title = page?.title || panel.page_path;
        const path = panel.page_path;

        try {
          const blocks = editor.document;
          const markdown = editor.blocksToMarkdownLossy(blocks);
          contextParts.push(`## ${title} (${path})\n\n${markdown}`);
        } catch (err) {
          console.error(`Failed to serialize page ${panel.page_id} for AI context:`, err);
        }
      }

      return contextParts.join("\n\n---\n\n");
    },
  }), []);

  // Split panels into collapsed (dock) and expanded
  const collapsedPanels = panels.filter((p) => p.collapsed);
  const expandedPanels = panels.filter((p) => !p.collapsed);

  // Ensure index page exists on first load
  useEffect(() => {
    if (pagesReady && !pageExists("index") && pages.size === 0) {
      createPage("index");
    }
  }, [pagesReady, pageExists, pages.size, createPage]);

  // Initialize panels: restore saved panels or open index page
  useEffect(() => {
    if (!pagesReady || panels.length > 0) return;

    // Try to restore saved panels from localStorage
    const savedPaths = loadSavedPanelPaths(wikiId);
    if (savedPaths && savedPaths.length > 0) {
      const pagesToOpen = savedPaths
        .map((path) => ({ path, page: getPage(path) }))
        .filter((p): p is { path: string; page: WikiPage } => p.page !== undefined)
        .map((p) => ({ path: p.path, id: p.page.id }));

      if (pagesToOpen.length > 0) {
        openMultiplePanels(pagesToOpen);
        return;
      }
    }

    // Fallback: open index page
    const indexPage = getPage("index");
    if (indexPage) {
      openPage("index", indexPage.id);
    }
  }, [pagesReady, panels.length, wikiId, getPage, openPage, openMultiplePanels]);

  // Auto-scroll to new panel
  useEffect(() => {
    if (containerRef.current && panels.length > 1) {
      const container = containerRef.current;
      // Scroll to the end (newest panel)
      container.scrollTo({
        left: container.scrollWidth,
        behavior: "smooth",
      });
    }
  }, [panels.length]);

  // Handle link click from editor
  const handleEditorLinkClick = useCallback(
    (event: WikiLinkClickEvent, existingPageId: string) => {
      // Check if page exists
      const exists = pageExists(event.path);

      if (exists) {
        const page = getPage(event.path);
        if (page) {
          handleLinkClick(event, page.id);
        }
      } else {
        // Create the page first (synchronous, stored in Y.js)
        try {
          const newPage = createPage(event.path);
          handleLinkClick(event, newPage.id);
        } catch (error) {
          console.error("Failed to create page:", error);
        }
      }
    },
    [pageExists, getPage, handleLinkClick, createPage]
  );

  // Handle page selection from sidebar
  const handleSelectPage = useCallback(
    (page: WikiPage) => {
      openPage(page.path, page.id);
    },
    [openPage]
  );

  // Handle new page creation from sidebar
  const handleCreatePageFromSidebar = useCallback(
    (path: string) => {
      try {
        const newPage = createPage(path);
        openPage(newPage.path, newPage.id);
        setShowSidebar(false);
      } catch (error) {
        console.error("Failed to create page:", error);
      }
    },
    [createPage, openPage]
  );

  // Handle delete page
  const handleDeletePage = useCallback(
    (pageId: string, panelIndex: number) => {
      try {
        deletePage(pageId);
        closePanel(panelIndex);
      } catch (error) {
        console.error("Failed to delete page:", error);
      }
    },
    [deletePage, closePanel]
  );

  // Update panel width
  const handlePanelResize = useCallback(
    (index: number, width: number) => {
      setPanelWidths((prev) => {
        const newWidths = [...prev];
        newWidths[index] = width;
        return newWidths;
      });
    },
    []
  );

  // Swipe handlers for mobile back navigation (must be before conditional returns)
  const swipeHandlers = useSwipeable({
    onSwipedRight: () => {
      if (!isDesktop && canGoBack) {
        goBack();
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50,
  });

  // Handle create new page from sidebar settings (must be before conditional returns)
  const handleCreateNewPage = useCallback(() => {
    setShowSidebar(true);
  }, []);

  // Toggle sidebar (stable reference to avoid infinite loops in WikiSettingsPanel)
  const handleToggleSidebar = useCallback(() => {
    setShowSidebar(prev => !prev);
    setShowTemplatesSidebar(false); // Close templates sidebar when opening pages
  }, []);

  // Toggle templates sidebar
  const handleToggleTemplatesSidebar = useCallback(() => {
    setShowTemplatesSidebar(prev => !prev);
    setShowSidebar(false); // Close pages sidebar when opening templates
  }, []);

  // Toggle book picker modal
  const handleToggleBookPicker = useCallback(() => {
    setShowBookPicker(prev => !prev);
  }, []);

  // Handle book selection from picker
  const handleSelectBook = useCallback((book: GroupBook) => {
    openBook(book.bookContentId, book.title);
    setShowBookPicker(false);
  }, [openBook]);

  // Handle template selection from sidebar
  const handleSelectTemplate = useCallback((template: WikiTemplate) => {
    // Check if already open
    const existingIndex = templatePanels.findIndex(t => t.id === template.id);
    if (existingIndex >= 0) {
      setActiveTemplateIndex(existingIndex);
      return;
    }
    // Add new panel
    setTemplatePanels(prev => [...prev, template]);
    setActiveTemplateIndex(templatePanels.length);
  }, [templatePanels]);

  // Handle create template from sidebar
  const handleCreateTemplateFromSidebar = useCallback(async (name: string) => {
    try {
      const newTemplate = await createTemplate(name);
      setTemplatePanels(prev => [...prev, newTemplate]);
      setActiveTemplateIndex(templatePanels.length);
      setShowTemplatesSidebar(false);
    } catch (error) {
      console.error("Failed to create template:", error);
    }
  }, [createTemplate, templatePanels.length]);

  // Handle update template
  const handleUpdateTemplate = useCallback(async (
    templateId: string,
    updates: { name?: string; prompt?: string; prompt_format?: 'text' | 'blocknote'; model?: string; description?: string; aliases?: string[]; include_selection?: boolean }
  ) => {
    try {
      await updateTemplate(templateId, updates);
      // Update local panel state if template is open
      setTemplatePanels(prev => prev.map(t => {
        if (t.id === templateId) {
          return {
            ...t,
            ...(updates.name && { name: updates.name }),
            ...(updates.prompt !== undefined && { prompt: updates.prompt }),
            ...(updates.prompt_format !== undefined && { prompt_format: updates.prompt_format }),
            ...(updates.model !== undefined && { model: updates.model }),
            ...(updates.description !== undefined && { description: updates.description }),
            ...(updates.aliases !== undefined && { aliases: updates.aliases }),
            ...(updates.include_selection !== undefined && { include_selection: updates.include_selection }),
          };
        }
        return t;
      }));
    } catch (error) {
      console.error("Failed to update template:", error);
    }
  }, [updateTemplate]);

  // Handle delete template
  const handleDeleteTemplate = useCallback(async (templateId: string, panelIndex: number) => {
    try {
      await deleteTemplate(templateId);
      setTemplatePanels(prev => prev.filter((_, i) => i !== panelIndex));
      if (activeTemplateIndex >= panelIndex && activeTemplateIndex > 0) {
        setActiveTemplateIndex(prev => prev - 1);
      }
    } catch (error) {
      console.error("Failed to delete template:", error);
    }
  }, [deleteTemplate, activeTemplateIndex]);

  // Handle close template panel
  const handleCloseTemplatePanel = useCallback((index: number) => {
    setTemplatePanels(prev => prev.filter((_, i) => i !== index));
    if (activeTemplateIndex >= index && activeTemplateIndex > 0) {
      setActiveTemplateIndex(prev => prev - 1);
    }
  }, [activeTemplateIndex]);

  // Update template panel width
  const handleTemplatePanelResize = useCallback((index: number, width: number) => {
    setTemplatePanelWidths(prev => {
      const newWidths = [...prev];
      newWidths[index] = width;
      return newWidths;
    });
  }, []);

  // Open a new AI scratch panel
  const handleOpenAIScratchPanel = useCallback((selectedText?: string) => {
    // Auto-select current editor for AI context
    const currentPanel = panels[active_panel_index];
    if (currentPanel && !currentPanel.selected_for_ai_context) {
      toggleAIContextSelection(currentPanel.id);
    }
    const newScratch = createScratch();
    // Store initial selected text if provided
    if (selectedText && newScratch) {
      setAIScratchInitialSelections(prev => {
        const updated = new Map(prev);
        updated.set(newScratch.id, selectedText);
        return updated;
      });
    }
    setActiveAIScratchIndex(aiScratchPanels.length);
  }, [createScratch, aiScratchPanels.length, panels, active_panel_index, toggleAIContextSelection]);

  // Close AI scratch panel
  const handleCloseAIScratchPanel = useCallback((scratchId: string, index: number) => {
    deleteScratch(scratchId);
    // Clean up initial selection
    setAIScratchInitialSelections(prev => {
      const updated = new Map(prev);
      updated.delete(scratchId);
      return updated;
    });
    if (activeAIScratchIndex >= index && activeAIScratchIndex > 0) {
      setActiveAIScratchIndex(prev => prev - 1);
    }
  }, [deleteScratch, activeAIScratchIndex]);

  // Update AI scratch panel model
  const handleAIScratchModelChange = useCallback((scratchId: string, model: string) => {
    updateScratch(scratchId, { model });
  }, [updateScratch]);

  // Resize AI scratch panel
  const handleAIScratchPanelResize = useCallback((index: number, width: number) => {
    setAIScratchPanelWidths(prev => {
      const newWidths = [...prev];
      newWidths[index] = width;
      return newWidths;
    });
  }, []);

  // Memoize the AI scratch context object
  const wikiAIScratchContext: WikiAIScratchContext = useMemo(() => ({
    openAIScratchPanel: handleOpenAIScratchPanel,
  }), [handleOpenAIScratchPanel]);

  // DnD sensors for panel reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevents accidental drags
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // Long press for mobile
        tolerance: 5,
      },
    })
  );

  // Handle drag end for panel reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Find indices in the full panels array (not just expanded)
      const fromIndex = panels.findIndex((p) => p.id === active.id);
      const toIndex = panels.findIndex((p) => p.id === over.id);

      if (fromIndex !== -1 && toIndex !== -1) {
        reorderPanels(fromIndex, toIndex);
      }
    }
  }, [panels, reorderPanels]);

  if (!pagesReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading wiki...</div>
      </div>
    );
  }

  // Get current page path and ID for settings display (only for page panels)
  const activePanel = panels[active_panel_index];
  const currentPagePath = activePanel && isPagePanel(activePanel) ? activePanel.page_path : "index";
  const currentPageId = activePanel && isPagePanel(activePanel) ? activePanel.page_id : undefined;

  return (
    <WikiEditorRegistryContext.Provider value={editorRegistry}>
      <WikiAIContextContext.Provider value={wikiAIContext}>
      <WikiAIScratchContext.Provider value={wikiAIScratchContext}>
      <div className="h-screen w-full flex flex-col bg-background">
        {/* Settings panel in app switcher sidebar */}
        <WikiSettingsPanel
          wikiId={wikiId}
          groupId={groupId}
          wikiTitle={wikiTitle}
          currentPagePath={currentPagePath}
          currentPageId={currentPageId}
          navMode={nav_mode}
          syncStatus={syncStatus}
          onNavModeChange={setNavMode}
          onToggleSidebar={handleToggleSidebar}
          onToggleTemplatesSidebar={handleToggleTemplatesSidebar}
          onToggleBookPicker={handleToggleBookPicker}
          onCreateNewPage={handleCreateNewPage}
          getRenamePreview={getRenamePreview}
          onRenamePage={renamePageWithChildren}
          backups={backups}
          isCreatingBackup={isCreatingBackup}
          onCreateBackup={handleCreateBackup}
        />

        {/* Main content area - full height without top bar */}
        <div className="flex-1 flex overflow-hidden" {...swipeHandlers}>
          {/* Pages Sidebar - hide in focus mode */}
          {showSidebar && !isFocusMode && (
            <WikiSidebar
              pageTree={pageTree}
              activePath={currentPagePath}
              onSelectPage={handleSelectPage}
              onCreatePage={handleCreatePageFromSidebar}
              onClose={() => setShowSidebar(false)}
              getPage={getPage}
            />
          )}

          {/* Templates Sidebar - hide in focus mode */}
          {showTemplatesSidebar && !isFocusMode && (
            <WikiTemplatesSidebar
              templates={templatesList}
              activeTemplateId={templatePanels[activeTemplateIndex]?.id}
              onSelectTemplate={handleSelectTemplate}
              onCreateTemplate={handleCreateTemplateFromSidebar}
              onClose={() => setShowTemplatesSidebar(false)}
              templateExists={templateExists}
            />
          )}

          {/* Dock for collapsed panels (desktop only) - hide in focus mode */}
          {isDesktop && collapsedPanels.length > 0 && !isFocusMode && (
            <WikiDock
              panels={collapsedPanels}
              allPanels={panels}
              getPage={getPage}
              getPageById={getPageById}
              activePanelId={panels[active_panel_index]?.id || null}
              onRestore={restorePanel}
              onReorder={reorderPanels}
            />
          )}

          {/* Panels container */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={expandedPanels.map((p) => p.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div
                ref={containerRef}
                className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
              >
                {/* Panels (only expanded ones) - page or reader */}
                {expandedPanels.map((panel) => {
                  // Find the original index for the panel
                  const originalIndex = panels.findIndex((p) => p.id === panel.id);
                  const isFocused = panel.id === focused_panel_id;
                  // In focus mode, panel takes full width
                  const width = isFocused
                    ? undefined
                    : isDesktop
                    ? panelWidths[originalIndex] || 500
                    : undefined;

                  // Handle reader panels differently
                  if (isReaderPanel(panel)) {
                    return (
                      <div
                        key={panel.id}
                        className="relative h-full flex-shrink-0 snap-start"
                        style={{
                          width: isFocused ? "100%" : isDesktop ? `${width}px` : "100%",
                          minWidth: isDesktop ? "200px" : "100%",
                          flexGrow: isFocused ? 1 : 0,
                        }}
                      >
                        <WikiReaderPanel
                          panel={panel}
                          isActive={originalIndex === active_panel_index}
                          isFirst={originalIndex === 0}
                          onClose={() => closePanel(originalIndex)}
                          onActivate={() => setActivePanel(originalIndex)}
                          width={width}
                          isFocused={isFocused}
                          onCollapse={() => collapsePanel(panel.id)}
                          onFocus={() => enterFocusMode(panel.id)}
                          onExitFocus={exitFocusMode}
                          canCollapse={expandedPanels.length > 1}
                          isDraggable={isDesktop && expandedPanels.length > 1 && !isFocused}
                        />
                      </div>
                    );
                  }

                  // Page panel (default)
                  const page = getPageById(panel.page_id) || getPage(panel.page_path);

                  return (
                    <div
                      key={panel.id}
                      className="relative h-full flex-shrink-0 snap-start"
                      style={{
                        width: isFocused ? "100%" : isDesktop ? `${width}px` : "100%",
                        minWidth: isDesktop ? "200px" : "100%",
                        flexGrow: isFocused ? 1 : 0,
                      }}
                    >
                      <WikiPanel
                        panel={panel}
                        page={page}
                        isActive={originalIndex === active_panel_index}
                        isFirst={originalIndex === 0}
                        index={originalIndex}
                        onLinkClick={handleEditorLinkClick}
                        pageExists={pageExists}
                        onClose={() => closePanel(originalIndex)}
                        onActivate={() => setActivePanel(originalIndex)}
                        onCreatePage={createPage}
                        onDeletePage={
                          originalIndex !== 0 && page
                            ? () => handleDeletePage(page.id, originalIndex)
                            : undefined
                        }
                        showResizeHandle={isDesktop && !isFocused}
                        width={width}
                        onResize={(w) => handlePanelResize(originalIndex, w)}
                        templates={templatesList}
                        isFocused={isFocused}
                        onCollapse={() => collapsePanel(panel.id)}
                        onFocus={() => enterFocusMode(panel.id)}
                        onExitFocus={exitFocusMode}
                        canCollapse={expandedPanels.length > 1}
                        pages={pages}
                        isDraggable={isDesktop && expandedPanels.length > 1 && !isFocused}
                        selectedForAIContext={panel.selected_for_ai_context}
                        onToggleAIContext={() => toggleAIContextSelection(panel.id)}
                        getRenamePreview={getRenamePreview}
                        onRenamePage={renamePageWithChildren}
                      />
                    </div>
                  );
                })}

                {/* Template panels */}
                {templatePanels.map((template, index) => {
                  const width = isDesktop
                    ? templatePanelWidths[index] || 400
                    : undefined;

                  return (
                    <div
                      key={`template-${template.id}`}
                      className="relative h-full flex-shrink-0 snap-start"
                      style={{
                        width: isDesktop ? `${width}px` : "100%",
                        minWidth: isDesktop ? "200px" : "100%",
                      }}
                    >
                      <WikiTemplatePanel
                        template={template}
                        isActive={index === activeTemplateIndex}
                        index={index}
                        onClose={() => handleCloseTemplatePanel(index)}
                        onActivate={() => setActiveTemplateIndex(index)}
                        onUpdate={(updates) => handleUpdateTemplate(template.id, updates)}
                        onDelete={() => handleDeleteTemplate(template.id, index)}
                        showResizeHandle={isDesktop}
                        width={width}
                        onResize={(w) => handleTemplatePanelResize(index, w)}
                      />
                    </div>
                  );
                })}

                {/* AI Scratch panels (persisted in Y.js) */}
                {aiScratchPanels.map((panel, index) => {
                  const width = isDesktop
                    ? aiScratchPanelWidths[index] || 450
                    : undefined;

                  return (
                    <div
                      key={panel.id}
                      className="relative h-full flex-shrink-0 snap-start"
                      style={{
                        width: isDesktop ? `${width}px` : "100%",
                        minWidth: isDesktop ? "200px" : "100%",
                      }}
                    >
                      <WikiAIScratchPanel
                        id={panel.id}
                        isActive={index === activeAIScratchIndex}
                        index={index}
                        onClose={() => handleCloseAIScratchPanel(panel.id, index)}
                        onActivate={() => setActiveAIScratchIndex(index)}
                        showResizeHandle={isDesktop}
                        width={width}
                        onResize={(w) => handleAIScratchPanelResize(index, w)}
                        model={panel.model}
                        onModelChange={(model) => handleAIScratchModelChange(panel.id, model)}
                        initialSelectedText={aiScratchInitialSelections.get(panel.id)}
                      />
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

        </div>
      </div>
      </WikiAIScratchContext.Provider>
      </WikiAIContextContext.Provider>
      {/* Book Picker Modal */}
      <BookPickerModal
        isOpen={showBookPicker}
        onClose={() => setShowBookPicker(false)}
        onSelectBook={handleSelectBook}
      />
    </WikiEditorRegistryContext.Provider>
  );
}
