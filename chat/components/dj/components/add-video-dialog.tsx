"use client";

import { useState, useCallback } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { Video, Plus, Link } from "lucide-react";
import { useQueueActions } from "../hooks/use-dj-actions";

// Check if string is a valid YouTube URL
function isYouTubeUrl(url: string): boolean {
  const patterns = [
    /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/,
  ];
  return patterns.some((pattern) => pattern.test(url.trim()));
}

// Extract video ID from YouTube URL
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

// Get YouTube thumbnail URL
function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

interface AddVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username?: string;
  isGuest?: boolean;
}

export function AddVideoDialog({
  open,
  onOpenChange,
  username,
  isGuest = false,
}: AddVideoDialogProps) {
  const [query, setQuery] = useState("");
  const [guestName, setGuestName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dj-guest-username') || '';
    }
    return '';
  });
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const { addVideo } = useQueueActions();

  // Effective username: use stored username for auth users, guest name for guests
  const effectiveUsername = isGuest ? guestName : username;

  const handleAdd = useCallback(() => {
    const trimmedUrl = query.trim();
    if (!isYouTubeUrl(trimmedUrl)) return;

    const videoId = extractYouTubeId(trimmedUrl);
    if (!videoId) return;

    // For guests, require a name
    if (isGuest && !guestName.trim()) {
      setShowNamePrompt(true);
      return;
    }

    // Save guest name to localStorage
    if (isGuest && guestName.trim()) {
      localStorage.setItem('dj-guest-username', guestName.trim());
    }

    addVideo({
      url: trimmedUrl,
      title: `YouTube Video (${videoId})`,
      thumbnail: getYouTubeThumbnail(videoId),
      added_by: effectiveUsername,
    });

    setQuery("");
    setShowNamePrompt(false);
    onOpenChange(false);
  }, [query, addVideo, effectiveUsername, isGuest, guestName, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && isYouTubeUrl(query.trim())) {
        e.preventDefault();
        handleAdd();
      }
    },
    [query, handleAdd]
  );

  const isValidUrl = isYouTubeUrl(query.trim());
  const videoId = isValidUrl ? extractYouTubeId(query.trim()) : null;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Paste a YouTube URL..."
        value={query}
        onValueChange={setQuery}
        onKeyDown={handleKeyDown}
      />
      <CommandList>
        {query.trim() === "" && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6 text-neutral-500">
              <Link className="w-8 h-8 opacity-50" />
              <p className="text-sm">Paste a YouTube URL to add to the queue</p>
            </div>
          </CommandEmpty>
        )}

        {query.trim() !== "" && !isValidUrl && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6 text-neutral-500">
              <Video className="w-8 h-8 opacity-50" />
              <p className="text-sm">Not a valid YouTube URL</p>
              <p className="text-xs text-neutral-600">
                Try youtube.com/watch?v=... or youtu.be/...
              </p>
            </div>
          </CommandEmpty>
        )}

        {isValidUrl && videoId && (
          <>
            {/* Guest name input */}
            {isGuest && (
              <div className="px-3 py-2 border-b border-neutral-800">
                <label className="text-xs text-neutral-500 block mb-1">Your name</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && guestName.trim()) {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                />
                {showNamePrompt && !guestName.trim() && (
                  <p className="text-xs text-red-400 mt-1">Please enter your name</p>
                )}
              </div>
            )}
            <CommandItem
              onSelect={handleAdd}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="w-16 h-9 rounded overflow-hidden bg-neutral-800 shrink-0">
                <img
                  src={getYouTubeThumbnail(videoId)}
                  alt="Video thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-300 truncate">
                  Add YouTube video
                </p>
                <p className="text-xs text-neutral-500 truncate">{query.trim()}</p>
              </div>
              <Plus className="w-4 h-4 text-neutral-500 shrink-0" />
            </CommandItem>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
