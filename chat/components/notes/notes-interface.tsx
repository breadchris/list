"use client";

import { useState, useCallback } from "react";
import { useNotes } from "@/hooks/notes/use-notes";
import { NotesList } from "./notes-list";
import { NoteEditor } from "./note-editor";
import { Plus, StickyNote } from "lucide-react";
import type { NoteContent } from "@/types/notes";

interface NotesInterfaceProps {
  groupId: string;
}

const ELECTRIC_URL = process.env.NEXT_PUBLIC_ELECTRIC_URL || "https://api.electric-sql.com";
const ELECTRIC_SOURCE_ID = process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID || "";

export function NotesInterface({ groupId }: NotesInterfaceProps) {
  const { notes, isLoading, createNote, deleteNote, updateNote } = useNotes({
    group_id: groupId,
  });
  const [selectedNote, setSelectedNote] = useState<NoteContent | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNote = useCallback(async () => {
    setIsCreating(true);
    const note = await createNote("Untitled");
    if (note) {
      setSelectedNote(note);
    }
    setIsCreating(false);
  }, [createNote]);

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      await deleteNote(noteId);
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
    },
    [deleteNote, selectedNote]
  );

  const handleRenameNote = useCallback(
    async (noteId: string, newTitle: string) => {
      await updateNote(noteId, { data: newTitle });
    },
    [updateNote]
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-950">
        <div className="flex items-center gap-3 text-neutral-400">
          <StickyNote className="w-5 h-5 animate-pulse" />
          <span>Loading notes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-neutral-950">
      {/* Notes sidebar */}
      <div className="w-64 border-r border-neutral-800 flex flex-col">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-100">Notes</h2>
          <button
            onClick={handleCreateNote}
            disabled={isCreating}
            className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 transition-colors disabled:opacity-50"
            title="Create new note"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <NotesList
          notes={notes}
          selectedId={selectedNote?.id}
          onSelect={setSelectedNote}
          onDelete={handleDeleteNote}
          onRename={handleRenameNote}
        />
      </div>

      {/* Note editor */}
      <div className="flex-1">
        {selectedNote ? (
          <NoteEditor
            key={selectedNote.id}
            note={selectedNote}
            electricUrl={ELECTRIC_URL}
            sourceId={ELECTRIC_SOURCE_ID}
            onTitleChange={(title) => handleRenameNote(selectedNote.id, title)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-neutral-500">
            <StickyNote className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg">Select a note or create a new one</p>
            <button
              onClick={handleCreateNote}
              disabled={isCreating}
              className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-neutral-200 transition-colors disabled:opacity-50"
            >
              Create Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
