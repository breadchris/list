"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VideoWithSection } from "../types";

// Extract YouTube video ID from URL
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
function getYouTubeThumbnail(url: string): string {
  const videoId = extractYouTubeId(url);
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }
  return "";
}

// Format duration as M:SS
function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface VideoQueueItemProps {
  video: VideoWithSection;
  onPlay: (index: number) => void;
  onRemove: (videoId: string) => void;
  isDraggable: boolean;
}

export function VideoQueueItem({
  video,
  onPlay,
  onRemove,
  isDraggable,
}: VideoQueueItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: video.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const thumbnail = video.thumbnail || getYouTubeThumbnail(video.url);
  const isCurrent = video.section === "current";
  const isPlayed = video.section === "played";
  const isUpcoming = video.section === "upcoming";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 p-2 rounded-lg transition-colors",
        isCurrent && "bg-violet-500/20 border border-violet-500/30",
        isPlayed && "opacity-50",
        isUpcoming && "hover:bg-neutral-800/50",
        isDragging && "opacity-50 bg-neutral-800 z-50"
      )}
    >
      {/* Drag handle - only for upcoming */}
      {isDraggable ? (
        <button
          className="touch-none cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400 shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      ) : (
        <div className="w-4 shrink-0" />
      )}

      {/* Thumbnail with play overlay */}
      <div
        className="relative w-16 h-9 rounded overflow-hidden bg-neutral-800 shrink-0 cursor-pointer group/thumb"
        onClick={() => onPlay(video.queue_index)}
      >
        {thumbnail && (
          <img
            src={thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        )}
        {/* Play overlay */}
        <div
          className={cn(
            "absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity",
            isCurrent ? "opacity-100" : "opacity-0 group-hover/thumb:opacity-100"
          )}
        >
          <Play
            className={cn(
              "w-5 h-5",
              isCurrent ? "text-violet-400" : "text-white"
            )}
            fill={isCurrent ? "currentColor" : "none"}
          />
        </div>
        {/* Duration badge */}
        {video.duration && (
          <div className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[10px] px-1 rounded">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>

      {/* Title and metadata */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            isCurrent ? "text-violet-300" : "text-neutral-300"
          )}
        >
          {video.title}
        </p>
        {video.added_by && (
          <p className="text-xs text-neutral-500 truncate">
            Added by {video.added_by}
          </p>
        )}
      </div>

      {/* Remove button - only for upcoming */}
      {isUpcoming && (
        <button
          onClick={() => onRemove(video.id)}
          className="shrink-0 p-1 text-neutral-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
