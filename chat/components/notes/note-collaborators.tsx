"use client";

import type { NoteCollaborator } from "@/types/notes";

interface NoteCollaboratorsProps {
  collaborators: NoteCollaborator[];
}

export function NoteCollaborators({ collaborators }: NoteCollaboratorsProps) {
  if (collaborators.length === 0) {
    return null;
  }

  // Show max 3 avatars, then +N for more
  const visibleCollabs = collaborators.slice(0, 3);
  const hiddenCount = collaborators.length - 3;

  return (
    <div className="flex items-center -space-x-2">
      {visibleCollabs.map((collab) => (
        <div
          key={collab.presence_ref || collab.user_id}
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white ring-2 ring-neutral-950"
          style={{ backgroundColor: collab.user_color }}
          title={collab.user_name}
        >
          {collab.user_name.charAt(0).toUpperCase()}
        </div>
      ))}
      {hiddenCount > 0 && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-neutral-700 text-neutral-300 ring-2 ring-neutral-950"
          title={`${hiddenCount} more collaborator${hiddenCount > 1 ? "s" : ""}`}
        >
          +{hiddenCount}
        </div>
      )}
    </div>
  );
}
