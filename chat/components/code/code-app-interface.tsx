"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { CodeChatPanel } from "./chat/code-chat-panel";
import { CodePreviewPanel } from "./preview/code-preview-panel";
import { useTsxVersions } from "@/hooks/code/use-tsx-versions";
import { useCodeSessionQuery, useUpdateCodeSessionMutation } from "@/hooks/code/use-code-session-queries";
import type { TsxVersion, CodeSessionMetadata, CodeMessage } from "./types";

interface CodeAppInterfaceProps {
  sessionId: string;
}

export function CodeAppInterface({ sessionId }: CodeAppInterfaceProps) {
  const router = useRouter();
  const [splitPosition, setSplitPosition] = useState(50); // Percentage
  const [previewOpen, setPreviewOpen] = useState(true); // Mobile preview collapsed state
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Query session data
  const { data: session, isLoading: sessionLoading } = useCodeSessionQuery(sessionId);
  const updateSession = useUpdateCodeSessionMutation();

  // Version management
  const {
    versions,
    selectedIndex,
    selectedVersion,
    addVersion,
    selectVersion,
  } = useTsxVersions();

  // Load versions from session metadata on mount
  useEffect(() => {
    if (session?.metadata?.versions && versions.length === 0) {
      const savedVersions = session.metadata.versions as TsxVersion[];
      savedVersions.forEach((v) => addVersion(v));
    }
  }, [session, addVersion, versions.length]);

  // Handle new version detection from chat
  const handleVersionDetected = useCallback(
    (version: TsxVersion) => {
      addVersion(version);

      // Save to session metadata
      const currentVersions = (session?.metadata?.versions as TsxVersion[]) || [];
      updateSession.mutate({
        sessionId,
        metadata: {
          ...session?.metadata,
          versions: [...currentVersions, version],
          last_prompt: version.prompt,
        } as Partial<CodeSessionMetadata>,
      });
    },
    [addVersion, session, sessionId, updateSession]
  );

  // Handle Claude session ID persistence
  const handleClaudeSessionId = useCallback(
    (claudeSessionId: string) => {
      updateSession.mutate({
        sessionId,
        metadata: {
          ...session?.metadata,
          claude_session_id: claudeSessionId,
        } as Partial<CodeSessionMetadata>,
      });
    },
    [session, sessionId, updateSession]
  );

  // Handle message history persistence
  const handleMessagesChange = useCallback(
    (messages: CodeMessage[]) => {
      updateSession.mutate({
        sessionId,
        metadata: {
          ...session?.metadata,
          messages,
        } as Partial<CodeSessionMetadata>,
      });
    },
    [session, sessionId, updateSession]
  );

  // Handle split resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Clamp between 20% and 80%
      setSplitPosition(Math.min(80, Math.max(20, newPosition)));
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  if (sessionLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-950">
        <div className="text-neutral-400">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-800 bg-neutral-900/50">
        <button
          onClick={() => router.push("/code")}
          className="p-2 -ml-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
          title="Back to sessions"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-medium text-neutral-100 truncate">
            {session?.data || "Code Session"}
          </h1>
        </div>
      </div>

      {/* Split view container */}
      <div ref={containerRef} className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Chat panel */}
        <div
          className="flex-1 min-h-0 overflow-hidden"
          style={!isMobile ? { width: `${splitPosition}%` } : undefined}
        >
          <CodeChatPanel
            sessionId={sessionId}
            groupId={session?.group_id || ""}
            initialClaudeSessionId={session?.metadata?.claude_session_id as string | undefined}
            initialMessages={session?.metadata?.messages as CodeMessage[] | undefined}
            onVersionDetected={handleVersionDetected}
            onClaudeSessionId={handleClaudeSessionId}
            onMessagesChange={handleMessagesChange}
          />
        </div>

        {/* Resize handle - desktop only */}
        <div
          onMouseDown={handleMouseDown}
          className="hidden md:flex w-1 flex-shrink-0 bg-neutral-800 hover:bg-indigo-500 cursor-col-resize transition-colors group relative"
        >
          <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center pointer-events-none">
            <GripVertical className="w-4 h-4 text-neutral-600 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>

        {/* Preview panel - collapsible on mobile */}
        <div
          className={`
            ${isMobile ? (previewOpen ? 'h-[50vh]' : 'h-12') : 'h-full'}
            border-t md:border-t-0 md:border-l border-neutral-800
            flex flex-col
            transition-[height] duration-200 ease-out
            md:transition-none
            flex-shrink-0
          `}
          style={!isMobile ? { width: `${100 - splitPosition}%` } : undefined}
        >
          {/* Mobile toggle header */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800">
            <button
              onClick={() => setPreviewOpen(!previewOpen)}
              className="flex items-center gap-2"
            >
              <span className="text-sm font-medium text-neutral-300">Preview</span>
              {previewOpen ? (
                <ChevronDown className="w-4 h-4 text-neutral-500" />
              ) : (
                <ChevronUp className="w-4 h-4 text-neutral-500" />
              )}
            </button>
            {versions.length > 0 && (
              <div className="text-xs text-neutral-500">
                v{selectedIndex + 1}
              </div>
            )}
          </div>

          {/* Preview content */}
          <div className={`flex-1 overflow-hidden ${isMobile && !previewOpen ? 'hidden' : 'flex flex-col'}`}>
            <CodePreviewPanel
              versions={versions}
              selectedIndex={selectedIndex}
              onSelectVersion={selectVersion}
              hideMobileHeader={isMobile}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
