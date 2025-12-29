"use client";

import { useState, useCallback, useEffect, useRef, createContext, useContext, useMemo } from "react";
import { YDocProvider } from "@y-sweet/react";
import { useSwipeable } from "react-swipeable";
import { WikiPanel } from "./wiki-panel";
import { WikiSidebar } from "./wiki-sidebar";
import { WikiTemplatesSidebar } from "./wiki-templates-sidebar";
import { WikiTemplatePanel } from "./wiki-template-panel";
import { WikiSettingsPanel } from "./wiki-settings-panel";
import { useWikiNav } from "@/hooks/wiki/use-wiki-nav";
import { useWikiPages } from "@/hooks/wiki/use-wiki-pages";
import { useWikiTemplates } from "@/hooks/wiki/use-wiki-templates";
import { useWikiRoomQuery } from "@/hooks/wiki/use-wiki-room-queries";
import type { WikiLinkClickEvent, WikiPage, WikiTemplate } from "@/types/wiki";
import type { BlockNoteEditor } from "@blocknote/core";

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
  return (
    <YDocProvider docId={`wiki-${wikiId}`} authEndpoint="/api/y-sweet-auth">
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

  // Sidebar visibility
  const [showSidebar, setShowSidebar] = useState(false);
  const [showTemplatesSidebar, setShowTemplatesSidebar] = useState(false);

  // Template panels state
  const [templatePanels, setTemplatePanels] = useState<WikiTemplate[]>([]);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(-1);
  const [templatePanelWidths, setTemplatePanelWidths] = useState<number[]>([]);

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
  } = useWikiNav({
    wiki_id: wikiId,
    initial_page_id: initialPage?.id,
    initial_page_path: initialPagePath,
  });

  // Ensure index page exists on first load
  useEffect(() => {
    if (pagesReady && !pageExists("index") && pages.size === 0) {
      createPage("index");
    }
  }, [pagesReady, pageExists, pages.size, createPage]);

  // Initialize first panel if needed
  useEffect(() => {
    if (pagesReady && panels.length === 0) {
      const indexPage = getPage("index");
      if (indexPage) {
        openPage("index", indexPage.id);
      }
    }
  }, [pagesReady, panels.length, getPage, openPage]);

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
    updates: { name?: string; prompt?: string; prompt_format?: 'text' | 'blocknote'; model?: string; description?: string; aliases?: string[] }
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

  if (!pagesReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-950">
        <div className="text-neutral-500">Loading wiki...</div>
      </div>
    );
  }

  // Get current page path for settings display
  const currentPagePath = panels[active_panel_index]?.page_path || "index";

  return (
    <WikiEditorRegistryContext.Provider value={editorRegistry}>
      <div className="h-screen w-full flex flex-col bg-neutral-950">
        {/* Settings panel in app switcher sidebar */}
        <WikiSettingsPanel
          wikiId={wikiId}
          groupId={groupId}
          wikiTitle={wikiTitle}
          currentPagePath={currentPagePath}
          navMode={nav_mode}
          onNavModeChange={setNavMode}
          onToggleSidebar={handleToggleSidebar}
          onToggleTemplatesSidebar={handleToggleTemplatesSidebar}
          onCreateNewPage={handleCreateNewPage}
        />

        {/* Main content area - full height without top bar */}
        <div className="flex-1 flex overflow-hidden" {...swipeHandlers}>
          {/* Pages Sidebar */}
          {showSidebar && (
            <WikiSidebar
              pageTree={pageTree}
              activePath={panels[active_panel_index]?.page_path}
              onSelectPage={handleSelectPage}
              onCreatePage={handleCreatePageFromSidebar}
              onClose={() => setShowSidebar(false)}
              getPage={getPage}
            />
          )}

          {/* Templates Sidebar */}
          {showTemplatesSidebar && (
            <WikiTemplatesSidebar
              templates={templatesList}
              activeTemplateId={templatePanels[activeTemplateIndex]?.id}
              onSelectTemplate={handleSelectTemplate}
              onCreateTemplate={handleCreateTemplateFromSidebar}
              onClose={() => setShowTemplatesSidebar(false)}
              templateExists={templateExists}
            />
          )}

          {/* Panels container */}
          <div
            ref={containerRef}
            className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
          >
            {/* Page panels */}
            {panels.map((panel, index) => {
              const page = getPageById(panel.page_id) || getPage(panel.page_path);
              const width = isDesktop
                ? panelWidths[index] || 500
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
                  <WikiPanel
                    panel={panel}
                    page={page}
                    isActive={index === active_panel_index}
                    isFirst={index === 0}
                    index={index}
                    onLinkClick={handleEditorLinkClick}
                    pageExists={pageExists}
                    onClose={() => closePanel(index)}
                    onActivate={() => setActivePanel(index)}
                    onCreatePage={createPage}
                    onDeletePage={
                      index !== 0 && page
                        ? () => handleDeletePage(page.id, index)
                        : undefined
                    }
                    showResizeHandle={isDesktop}
                    width={width}
                    onResize={(w) => handlePanelResize(index, w)}
                    templates={templatesList}
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
          </div>

        </div>
      </div>
    </WikiEditorRegistryContext.Provider>
  );
}
