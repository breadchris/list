"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { YDocProvider } from "@y-sweet/react";
import { Menu, Settings, Plus, ChevronLeft } from "lucide-react";
import { WikiPanel } from "./wiki-panel";
import { WikiSidebar } from "./wiki-sidebar";
import { WikiSettings } from "./wiki-settings";
import { useWikiNav } from "@/hooks/wiki/use-wiki-nav";
import { useWikiPages } from "@/hooks/wiki/use-wiki-pages";
import type { WikiLinkClickEvent, WikiPage } from "@/types/wiki";

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
  // Sidebar and settings visibility
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  // Wiki pages management
  const {
    pages,
    pageTree,
    isLoading: pagesLoading,
    error: pagesError,
    getPage,
    getPageById,
    createPage,
    deletePage,
    pageExists,
    refresh: refreshPages,
  } = useWikiPages({ wiki_id: wikiId, group_id: groupId });

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
    if (!pagesLoading && !pageExists("index") && pages.size === 0) {
      createPage("index", "# Welcome to your Wiki\n\nStart editing to build your knowledge base.");
    }
  }, [pagesLoading, pageExists, pages.size, createPage]);

  // Initialize first panel if needed
  useEffect(() => {
    if (!pagesLoading && panels.length === 0) {
      const indexPage = getPage("index");
      if (indexPage) {
        openPage("index", indexPage.id);
      }
    }
  }, [pagesLoading, panels.length, getPage, openPage]);

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
    async (event: WikiLinkClickEvent, existingPageId: string) => {
      // Check if page exists
      const exists = pageExists(event.path);

      if (exists) {
        const page = getPage(event.path);
        if (page) {
          handleLinkClick(event, page.id);
        }
      } else {
        // Create the page first
        try {
          const newPage = await createPage(event.path);
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
      setShowSidebar(false);
    },
    [openPage]
  );

  // Handle new page creation from sidebar
  const handleCreatePageFromSidebar = useCallback(
    async (path: string) => {
      try {
        const newPage = await createPage(path);
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
    async (pageId: string, panelIndex: number) => {
      try {
        await deletePage(pageId);
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

  if (pagesLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-950">
        <div className="text-neutral-500">Loading wiki...</div>
      </div>
    );
  }

  if (pagesError) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-neutral-950">
        <div className="text-red-400">{pagesError}</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-neutral-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          {/* Menu button */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Back button (mobile) */}
          {!isDesktop && canGoBack && (
            <button
              onClick={goBack}
              className="p-2 text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Go back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <h1 className="text-neutral-200 font-medium">Wiki</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* New page button */}
          <button
            onClick={() => setShowSidebar(true)}
            className="p-2 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="New page"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
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

        {/* Panels container */}
        <div
          ref={containerRef}
          className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
        >
          {panels.map((panel, index) => {
            const page = getPageById(panel.page_id) || getPage(panel.page_path);
            const width = isDesktop
              ? panelWidths[index] || 400
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
                  showResizeHandle={isDesktop && index < panels.length - 1}
                  width={width}
                  onResize={(w) => handlePanelResize(index, w)}
                />
              </div>
            );
          })}
        </div>

        {/* Settings panel */}
        {showSettings && (
          <WikiSettings
            navMode={nav_mode}
            onNavModeChange={setNavMode}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    </div>
  );
}
