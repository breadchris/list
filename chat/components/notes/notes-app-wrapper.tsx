"use client";

import { useGlobalGroup } from "@/components/GlobalGroupContext";
import { NotesInterface } from "./notes-interface";
import { StickyNote } from "lucide-react";

export function NotesAppWrapper() {
  const { selectedGroup, isLoading } = useGlobalGroup();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-950">
        <div className="flex items-center gap-3 text-neutral-400">
          <StickyNote className="w-5 h-5 animate-pulse" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!selectedGroup) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500 bg-neutral-950">
        <div className="text-center">
          <StickyNote className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a group to view notes</p>
        </div>
      </div>
    );
  }

  return <NotesInterface groupId={selectedGroup.id} />;
}
