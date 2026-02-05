"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { useRabbitHoleRoomQuery, useUpdateRabbitHolePageMutation } from "@/hooks/rabbit-hole/use-rabbit-hole-rooms";
import { useRabbitHoleNav } from "@/hooks/rabbit-hole/use-rabbit-hole-nav";
import { useRabbitHoleStream } from "@/hooks/rabbit-hole/use-rabbit-hole-stream";
import { RabbitHolePanel } from "./RabbitHolePanel";
import { RabbitHoleSidebar } from "./RabbitHoleSidebar";
import { RabbitHoleInput } from "./RabbitHoleInput";
import type { RabbitHolePage } from "@/types/rabbit-hole";

interface RabbitHoleInterfaceProps {
  roomId: string;
  isReadOnly?: boolean;
}

export function RabbitHoleInterface({
  roomId,
  isReadOnly = false,
}: RabbitHoleInterfaceProps) {
  const [showSidebar, setShowSidebar] = useState(true);
  const [isDesktop, setIsDesktop] = useState(true);
  const [streamingPageId, setStreamingPageId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamContentRef = useRef<string>("");

  // Fetch room data
  const { data: room, isLoading: roomLoading } = useRabbitHoleRoomQuery(roomId);
  const updatePageMutation = useUpdateRabbitHolePageMutation();

  // Get pages from room metadata
  const pages = room?.metadata?.pages || {};
  const rootPageId = room?.metadata?.root_page_id || null;

  // Navigation state
  const {
    panels,
    activePanelIndex,
    openPage,
    closePanel,
    setActivePanel,
    initializePanels,
  } = useRabbitHoleNav({ pages, rootPageId });

  // Stream hook
  const { content: streamContent, isStreaming, startStream, cancelStream } = useRabbitHoleStream({
    onStreamComplete: useCallback(
      async (content: string) => {
        if (streamingPageId && room) {
          const existingPage = pages[streamingPageId];
          if (existingPage) {
            await updatePageMutation.mutateAsync({
              roomId,
              pageId: streamingPageId,
              page: { ...existingPage, content, status: "complete" },
            });
          }
        }
        setStreamingPageId(null);
      },
      [streamingPageId, room, pages, roomId, updatePageMutation]
    ),
    onStreamError: useCallback(
      async (error: string) => {
        if (streamingPageId && room) {
          const existingPage = pages[streamingPageId];
          if (existingPage) {
            await updatePageMutation.mutateAsync({
              roomId,
              pageId: streamingPageId,
              page: { ...existingPage, status: "error" },
            });
          }
        }
        setStreamingPageId(null);
      },
      [streamingPageId, room, pages, roomId, updatePageMutation]
    ),
  });

  // Keep ref in sync with streaming content
  streamContentRef.current = streamContent;

  // Check for desktop
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Auto-scroll to new panels
  useEffect(() => {
    if (containerRef.current && panels.length > 0) {
      const container = containerRef.current;
      // Scroll to the active panel
      setTimeout(() => {
        container.scrollTo({
          left: container.scrollWidth,
          behavior: "smooth",
        });
      }, 100);
    }
  }, [panels.length]);

  // Start a new exploration
  const handleStartExploration = useCallback(
    async (query: string) => {
      if (!room || isReadOnly) return;

      const pageId = crypto.randomUUID();
      const newPage: RabbitHolePage = {
        id: pageId,
        query,
        content: "",
        status: "streaming",
        created_at: new Date().toISOString(),
      };

      // Save page and set as root
      await updatePageMutation.mutateAsync({
        roomId,
        pageId,
        page: newPage,
        setAsRoot: true,
      });

      // Initialize panels with new page
      initializePanels(pageId);

      // Start streaming
      setStreamingPageId(pageId);
      startStream(query);
    },
    [room, roomId, isReadOnly, updatePageMutation, initializePanels, startStream]
  );

  // Handle link click - create new page and start streaming
  const handleLinkClick = useCallback(
    async (
      linkText: string,
      linkTarget: string,
      contextSnippet: string,
      sourcePageId: string
    ) => {
      if (!room || isReadOnly) return;

      const pageId = crypto.randomUUID();
      const newPage: RabbitHolePage = {
        id: pageId,
        query: linkTarget,
        content: "",
        parent_page_id: sourcePageId,
        link_text: linkText,
        context: contextSnippet,
        status: "streaming",
        created_at: new Date().toISOString(),
      };

      // Save page
      await updatePageMutation.mutateAsync({
        roomId,
        pageId,
        page: newPage,
      });

      // Open panel for new page
      openPage(pageId);

      // Start streaming with context
      setStreamingPageId(pageId);
      startStream(linkTarget, contextSnippet, linkText);
    },
    [room, roomId, isReadOnly, updatePageMutation, openPage, startStream]
  );

  // Handle regenerate
  const handleRegenerate = useCallback(
    async (pageId: string) => {
      if (!room || isReadOnly) return;

      const page = pages[pageId];
      if (!page) return;

      // Update page status
      await updatePageMutation.mutateAsync({
        roomId,
        pageId,
        page: { ...page, content: "", status: "streaming" },
      });

      // Start streaming
      setStreamingPageId(pageId);
      startStream(page.query, page.context, page.link_text);
    },
    [room, roomId, isReadOnly, pages, updatePageMutation, startStream]
  );

  // Handle cancel streaming
  const handleCancel = useCallback(
    async (pageId: string) => {
      if (!room || pageId !== streamingPageId) return;

      cancelStream();

      try {
        // Use ref for latest content, don't rely on pages cache existing
        const existingPage = pages[pageId];
        await updatePageMutation.mutateAsync({
          roomId,
          pageId,
          page: {
            id: pageId,
            query: existingPage?.query || "",
            content: streamContentRef.current,
            status: "complete",
            parent_page_id: existingPage?.parent_page_id,
            link_text: existingPage?.link_text,
            context: existingPage?.context,
            created_at: existingPage?.created_at || new Date().toISOString(),
          },
        });
      } finally {
        // Always clear streaming state, even if mutation fails
        setStreamingPageId(null);
      }
    },
    [room, streamingPageId, pages, roomId, cancelStream, updatePageMutation]
  );

  // Get current streaming content for a page
  const getPageContent = useCallback(
    (page: RabbitHolePage): RabbitHolePage => {
      // Currently streaming OR just finished streaming this page
      // Keep using streamContent until streamingPageId is cleared (after mutation completes)
      if (page.id === streamingPageId) {
        return {
          ...page,
          content: streamContent || page.content,
          status: isStreaming ? "streaming" : "complete",
        };
      }
      // Page has stale "streaming" status but no active stream - force complete
      // (handles: cancelled stream, page reload, stuck state)
      if (page.status === "streaming") {
        return { ...page, status: "complete" };
      }
      return page;
    },
    [streamingPageId, isStreaming, streamContent]
  );

  // Get active page ID
  const activePageId = panels[activePanelIndex]?.page_id || null;

  if (roomLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Room not found</div>
      </div>
    );
  }

  const hasPages = Object.keys(pages).length > 0;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          {/* Sidebar toggle */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          >
            {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="text-lg font-medium text-foreground truncate">
            {room.metadata?.title || room.data || "Exploration"}
          </h1>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (isDesktop || !hasPages) && (
          <div className="w-64 shrink-0">
            <RabbitHoleSidebar
              pages={pages}
              rootPageId={rootPageId}
              activePageId={activePageId}
              onSelectPage={openPage}
            />
          </div>
        )}

        {/* Panels container */}
        <div className="flex-1 overflow-hidden">
          {!hasPages ? (
            // Show input when no pages exist
            <RabbitHoleInput
              onSubmit={handleStartExploration}
              isLoading={isStreaming}
            />
          ) : (
            // Show panels
            <div
              ref={containerRef}
              className="h-full flex overflow-x-auto"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {panels.map((panel, index) => {
                const page = pages[panel.page_id];
                if (!page) return null;

                return (
                  <div key={panel.id} style={{ scrollSnapAlign: "start" }}>
                    <RabbitHolePanel
                      page={getPageContent(page)}
                      isActive={index === activePanelIndex}
                      isFirst={index === 0}
                      isReadOnly={isReadOnly}
                      onLinkClick={(linkText, linkTarget, contextSnippet) =>
                        handleLinkClick(linkText, linkTarget, contextSnippet, page.id)
                      }
                      onClose={() => closePanel(index)}
                      onActivate={() => setActivePanel(index)}
                      onRegenerate={() => handleRegenerate(page.id)}
                      onCancel={() => handleCancel(page.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
