"use client";

import { Content } from "@/lib/list/ContentRepository";
import { Image, Clock } from "lucide-react";

interface ArtRequestCardProps {
  request: Content;
  onClick: () => void;
}

export function ArtRequestCard({ request, onClick }: ArtRequestCardProps) {
  const createdAt = new Date(request.created_at);
  const timeAgo = getTimeAgo(createdAt);

  return (
    <button
      onClick={onClick}
      className="text-left p-4 bg-neutral-900 border border-neutral-800 rounded-lg hover:border-pink-600/50 transition-colors"
    >
      {/* Prompt preview */}
      <p className="text-white line-clamp-3 mb-3">{request.data}</p>

      {/* Meta info */}
      <div className="flex items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo}
        </span>
        {request.child_count && request.child_count > 0 && (
          <span className="flex items-center gap-1">
            <Image className="w-3 h-3" />
            {request.child_count}
          </span>
        )}
      </div>
    </button>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
