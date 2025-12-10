"use client";

import { useState, useEffect } from "react";
import { ListVideo, Link2, ChevronUp, ChevronDown, Plus } from "lucide-react";
import { useDjInitialization } from "./hooks/use-dj-initialization";
import { useCurrentVideo } from "./hooks/use-dj-state";
import { useDjRoomQuery } from "@/hooks/list/useDjRoomQueries";
import { VideoPlayer } from "./components/video-player";
import { VideoQueue } from "./components/video-queue";
import { AddVideoDialog } from "./components/add-video-dialog";
import { DjSettingsPanel } from "./components/dj-settings-panel";

interface DjAppInterfaceProps {
  roomId: string;
}

export function DjAppInterface({ roomId }: DjAppInterfaceProps) {
  // Initialize Yjs document
  useDjInitialization();

  const currentVideo = useCurrentVideo();
  const { data: room } = useDjRoomQuery(roomId);
  const [commandOpen, setCommandOpen] = useState(false);
  const [username, setUsername] = useState<string | undefined>();
  const [queueOpen, setQueueOpen] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  // Get username from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem("chat-username");
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  // Cmd+K to open add video dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    <div className="h-full flex flex-col md:flex-row bg-neutral-950">
      {/* Register settings panel */}
      <DjSettingsPanel roomId={roomId} roomName={roomName} />

      {/* Main content - Video Player */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-3 md:py-4 border-b border-neutral-800">
          <div className="p-1.5 md:p-2 rounded-lg bg-violet-400/10 shrink-0">
            <ListVideo className="w-4 h-4 md:w-5 md:h-5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-semibold text-neutral-100 truncate">
              {roomName}
            </h1>
            <p className="text-xs md:text-sm text-neutral-500 hidden sm:block">
              Collaborative video queue for watching together
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyLink}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
              title="Copy room link"
            >
              {copySuccess ? (
                <span className="text-xs text-green-400">Copied!</span>
              ) : (
                <Link2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setCommandOpen(true)}
              className="px-2 md:px-3 py-1.5 text-sm text-neutral-400 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors flex items-center gap-1 md:gap-2"
            >
              <Plus className="w-4 h-4 md:hidden" />
              <span className="hidden md:inline">Add Video</span>
              <kbd className="text-xs bg-neutral-700 px-1.5 py-0.5 rounded hidden md:inline">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>

        {/* Video Player area */}
        <div className="flex-1 flex items-center justify-center p-3 md:p-6 min-h-0">
          <div className="w-full max-w-4xl h-full flex items-center">
            <VideoPlayer video={currentVideo} />
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
        {/* Mobile toggle header */}
        <button
          onClick={() => setQueueOpen(!queueOpen)}
          className="md:hidden flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800"
        >
          <span className="text-sm font-medium text-neutral-300">Queue</span>
          {queueOpen ? (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-neutral-500" />
          )}
        </button>

        {/* Queue content */}
        <div className={`flex-1 overflow-hidden ${!queueOpen ? "hidden md:flex md:flex-col" : "flex flex-col"}`}>
          <VideoQueue />
        </div>
      </div>

      {/* Add Video Dialog */}
      <AddVideoDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        username={username}
      />
    </div>
  );
}
