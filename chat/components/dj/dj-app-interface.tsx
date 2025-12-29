"use client";

import { useState, useEffect } from "react";
import { Link2, ChevronUp, ChevronDown, Plus } from "lucide-react";
import { useDjInitialization } from "./hooks/use-dj-initialization";
import { useCurrentVideo } from "./hooks/use-dj-state";
import { useDjRoomQuery } from "@/hooks/list/useDjRoomQueries";
import { VideoPlayer } from "./components/video-player";
import { VideoQueue } from "./components/video-queue";
import { AddVideoDialog } from "./components/add-video-dialog";
import { DjSettingsPanel } from "./components/dj-settings-panel";
import { getFeatureFlag } from "@/utils/featureFlags";

interface DjAppInterfaceProps {
  roomId: string;
  /** Pre-spawned Jamsocket timer backend URL (from server component) */
  timerBackendUrl?: string | null;
  /** Guest mode: 'watch' for view-only, 'contribute' for adding videos */
  guestMode?: 'watch' | 'contribute';
}

export function DjAppInterface({ roomId, timerBackendUrl, guestMode }: DjAppInterfaceProps) {
  // Initialize Yjs document
  useDjInitialization();

  const currentVideo = useCurrentVideo();
  const { data: room } = useDjRoomQuery(roomId);
  const [commandOpen, setCommandOpen] = useState(false);
  const [username, setUsername] = useState<string | undefined>();
  const [queueOpen, setQueueOpen] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  // Guest access flags
  const isGuest = !!guestMode;
  const canAddVideos = !isGuest || guestMode === 'contribute';
  const canModifyQueue = !isGuest; // Only authenticated users can remove/reorder

  // Check if server timer is enabled
  const useServerTimer = getFeatureFlag("enableServerTimer");

  // For development: use environment variable for timer backend URL
  // In production, this would be spawned via Jamsocket API
  const effectiveTimerUrl = useServerTimer
    ? (timerBackendUrl ?? process.env.NEXT_PUBLIC_DJ_TIMER_URL ?? null)
    : null;

  // Get username from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem("chat-username");
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  // Cmd+K to open add video dialog (only if user can add videos)
  useEffect(() => {
    if (!canAddVideos) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canAddVideos]);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/dj/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const roomName = room?.data || "DJ Room";

  return (
    <div className={`h-full flex flex-col md:flex-row bg-neutral-950 ${isGuest ? 'pt-10' : ''}`}>
      {/* Register settings panel (not for guests) */}
      {!isGuest && <DjSettingsPanel roomId={roomId} roomName={roomName} />}

      {/* Main content - Video Player */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Video Player area */}
        <div className="flex-1 flex items-center justify-center p-3 md:p-6 min-h-0">
          <div className="w-full max-w-4xl h-full flex items-center">
            <VideoPlayer video={currentVideo} timerBackendUrl={effectiveTimerUrl} />
          </div>
        </div>
      </div>

      {/* Queue - Collapsible on mobile, fixed sidebar on desktop */}
      <div
        className={`
          ${queueOpen ? "h-[40vh]" : "h-12"}
          md:h-full md:w-80
          border-t md:border-t-0 md:border-l border-neutral-800
          flex flex-col
          transition-[height] duration-200 ease-out
          md:transition-none
        `}
      >
        {/* Mobile toggle header with actions */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800">
          <button
            onClick={() => setQueueOpen(!queueOpen)}
            className="flex items-center gap-2"
          >
            <span className="text-sm font-medium text-neutral-300">Queue</span>
            {queueOpen ? (
              <ChevronDown className="w-4 h-4 text-neutral-500" />
            ) : (
              <ChevronUp className="w-4 h-4 text-neutral-500" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
              title="Copy room link"
            >
              {copySuccess ? (
                <span className="text-xs text-green-400">Copied!</span>
              ) : (
                <Link2 className="w-4 h-4" />
              )}
            </button>
            {canAddVideos && (
              <button
                onClick={() => setCommandOpen(true)}
                className="p-1.5 text-neutral-400 hover:bg-neutral-700 rounded transition-colors"
                title="Add video (⌘K)"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop header with actions */}
        <div className="hidden md:flex items-center justify-between px-4 py-2 border-b border-neutral-800">
          <span className="text-sm font-medium text-neutral-300">Queue</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
              title="Copy room link"
            >
              {copySuccess ? (
                <span className="text-xs text-green-400">Copied!</span>
              ) : (
                <Link2 className="w-4 h-4" />
              )}
            </button>
            {canAddVideos && (
              <button
                onClick={() => setCommandOpen(true)}
                className="p-1.5 text-neutral-400 hover:bg-neutral-700 rounded transition-colors"
                title="Add video (⌘K)"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Queue content */}
        <div className={`flex-1 overflow-hidden ${!queueOpen ? "hidden md:flex md:flex-col" : "flex flex-col"}`}>
          <VideoQueue readOnly={!canModifyQueue} />
        </div>
      </div>

      {/* Add Video Dialog */}
      {canAddVideos && (
        <AddVideoDialog
          open={commandOpen}
          onOpenChange={setCommandOpen}
          username={username}
          isGuest={isGuest}
        />
      )}

      {/* Guest Banner */}
      {isGuest && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-neutral-900/95 border-b border-neutral-800 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-neutral-400">
            {guestMode === 'watch' ? 'Watching as guest' : 'Contributing as guest'}
          </span>
          <a
            href="/auth/login"
            className="text-sm text-violet-400 hover:text-violet-300"
          >
            Sign in
          </a>
        </div>
      )}
    </div>
  );
}
