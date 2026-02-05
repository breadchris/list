"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { useElectricDoc } from "@/hooks/notes/use-electric-doc";
import { NoteCollaborators } from "./note-collaborators";
import { NoteSyncStatus } from "./note-sync-status";
import type { NoteContent } from "@/types/notes";

import "@blocknote/shadcn/style.css";
import "@blocknote/core/fonts/inter.css";

// Generate random user identity
const generateUserColor = () => {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A",
    "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const generateUserName = () => {
  const adjectives = ["Happy", "Swift", "Bright", "Clever", "Gentle"];
  const nouns = ["Panda", "Fox", "Eagle", "Dolphin", "Tiger"];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${
    nouns[Math.floor(Math.random() * nouns.length)]
  }`;
};

// Store user identity in localStorage for consistency
const getUserIdentity = () => {
  if (typeof window === "undefined") {
    return { userName: generateUserName(), userColor: generateUserColor(), userId: crypto.randomUUID() };
  }

  const stored = localStorage.getItem("notes-user-identity");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fall through to generate new identity
    }
  }

  const identity = {
    userName: generateUserName(),
    userColor: generateUserColor(),
    userId: crypto.randomUUID(),
  };
  localStorage.setItem("notes-user-identity", JSON.stringify(identity));
  return identity;
};

interface NoteEditorProps {
  note: NoteContent;
  electricUrl: string;
  sourceId: string;
  onTitleChange?: (title: string) => void;
}

export function NoteEditor({ note, electricUrl, sourceId, onTitleChange }: NoteEditorProps) {
  const { resolvedTheme } = useTheme();
  const [identity] = useState(getUserIdentity);
  const [title, setTitle] = useState(note.data); // data field contains the title

  const { doc, provider, syncStatus, collaborators } = useElectricDoc({
    note_id: note.id,
    electric_url: electricUrl,
    source_id: sourceId,
    api_endpoint: "/api",
    user_name: identity.userName,
    user_color: identity.userColor,
    user_id: identity.userId,
  });

  // Get Yjs fragment for BlockNote
  const fragment = useMemo(() => {
    if (!doc) return null;
    return doc.getXmlFragment("content");
  }, [doc]);

  // Create BlockNote editor with collaboration
  const editor = useCreateBlockNote(
    {
      collaboration: fragment && provider
        ? {
            provider: provider as unknown as { awareness: { on: (event: string, cb: () => void) => void } },
            fragment: fragment,
            user: {
              name: identity.userName,
              color: identity.userColor,
            },
          }
        : undefined,
    },
    [fragment, provider, identity.userName, identity.userColor]
  );

  // Update title in parent when changed
  const handleTitleBlur = useCallback(() => {
    if (title !== note.data && onTitleChange) {
      onTitleChange(title);
    }
  }, [title, note.data, onTitleChange]);

  // Sync title from prop
  useEffect(() => {
    setTitle(note.data);
  }, [note.data]);

  if (!doc || !fragment) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-950">
        <div className="flex items-center gap-3 text-neutral-400">
          <div className="w-5 h-5 border-2 border-neutral-600 border-t-yellow-500 rounded-full animate-spin" />
          <span>Connecting...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      {/* Header with title, collaborators and sync status */}
      <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="text-lg font-semibold text-neutral-100 bg-transparent border-none outline-none flex-1 placeholder-neutral-600"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-4">
          <NoteCollaborators collaborators={collaborators} />
          <NoteSyncStatus status={syncStatus} />
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <BlockNoteView
          editor={editor}
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          className="h-full min-h-full"
        />
      </div>
    </div>
  );
}
