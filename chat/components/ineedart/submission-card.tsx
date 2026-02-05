"use client";

import { useState } from "react";
import { Content } from "@/lib/list/ContentRepository";
import { Star, User } from "lucide-react";

interface SubmissionCardProps {
  submission: Content;
  isOwner: boolean;
  onToggleFavorite: (submissionId: string, isFavorited: boolean) => void;
}

export function SubmissionCard({
  submission,
  isOwner,
  onToggleFavorite,
}: SubmissionCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const artistName = submission.metadata?.artist_name || "Anonymous";
  const isFavorited = submission.metadata?.is_favorited || false;
  const createdAt = new Date(submission.created_at);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOwner) {
      onToggleFavorite(submission.id, !isFavorited);
    }
  };

  return (
    <div className="break-inside-avoid mb-3">
      <div className="relative group bg-neutral-900 rounded-lg overflow-hidden">
        {/* Image */}
        <img
          src={submission.data}
          alt={`Art by ${artistName}`}
          className={`w-full transition-opacity duration-300 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setImageLoaded(true)}
        />

        {/* Loading placeholder */}
        {!imageLoaded && (
          <div className="w-full aspect-square bg-neutral-800 animate-pulse" />
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white text-sm">
                <User className="w-4 h-4" />
                <span className="truncate">{artistName}</span>
              </div>
              <span className="text-neutral-400 text-xs">
                {createdAt.toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Favorite star (owner only) */}
        {isOwner && (
          <button
            onClick={handleFavoriteClick}
            className={`absolute top-2 right-2 p-2 rounded-full transition-all ${
              isFavorited
                ? "bg-yellow-500 text-white"
                : "bg-black/50 text-white opacity-0 group-hover:opacity-100"
            }`}
          >
            <Star
              className={`w-4 h-4 ${isFavorited ? "fill-current" : ""}`}
            />
          </button>
        )}

        {/* Favorite indicator (always visible when favorited) */}
        {isFavorited && !isOwner && (
          <div className="absolute top-2 right-2 p-2 bg-yellow-500 text-white rounded-full">
            <Star className="w-4 h-4 fill-current" />
          </div>
        )}
      </div>
    </div>
  );
}
