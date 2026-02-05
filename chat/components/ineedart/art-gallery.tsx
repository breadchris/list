"use client";

import { Content } from "@/lib/list/ContentRepository";
import { SubmissionCard } from "./submission-card";
import { ImageIcon } from "lucide-react";

interface ArtGalleryProps {
  submissions: Content[];
  isOwner: boolean;
  onToggleFavorite: (submissionId: string, isFavorited: boolean) => void;
}

export function ArtGallery({ submissions, isOwner, onToggleFavorite }: ArtGalleryProps) {
  if (submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <ImageIcon className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
        <p className="text-neutral-400">No submissions yet</p>
        <p className="text-neutral-500 text-sm mt-1">
          Share the link with artists to get started
        </p>
      </div>
    );
  }

  return (
    <div className="columns-2 sm:columns-3 gap-3 space-y-3">
      {submissions.map((submission) => (
        <SubmissionCard
          key={submission.id}
          submission={submission}
          isOwner={isOwner}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
