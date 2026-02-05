"use client";

import { useState, useCallback } from "react";
import { StickyNote, Trash2, Pencil, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { NoteContent } from "@/types/notes";

interface NotesListProps {
  notes: NoteContent[];
  selectedId?: string;
  onSelect: (note: NoteContent) => void;
  onDelete: (noteId: string) => void;
  onRename: (noteId: string, newTitle: string) => void;
}

export function NotesList({
  notes,
  selectedId,
  onSelect,
  onDelete,
  onRename,
}: NotesListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startEditing = useCallback((note: NoteContent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(note.id);
    setEditTitle(note.data); // data field contains the title
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
  }, [editingId, editTitle, onRename]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        saveEdit();
      } else if (e.key === "Escape") {
        cancelEdit();
      }
    },
    [saveEdit, cancelEdit]
  );

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-neutral-500">
        <StickyNote className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">No notes yet</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {notes.map((note) => (
        <div
          key={note.id}
          onClick={() => onSelect(note)}
          className={`group px-4 py-3 cursor-pointer border-b border-neutral-800 hover:bg-neutral-900 transition-colors ${
            selectedId === note.id ? "bg-neutral-800" : ""
          }`}
        >
          {editingId === note.id ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="flex-1 bg-neutral-700 px-2 py-1 rounded text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-yellow-500"
              />
              <button
                onClick={saveEdit}
                className="p-1 hover:bg-neutral-700 rounded text-green-500"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={cancelEdit}
                className="p-1 hover:bg-neutral-700 rounded text-neutral-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-neutral-200 truncate flex-1">
                  {note.data}
                </h3>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => startEditing(note, e)}
                    className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-200"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(note.id);
                    }}
                    className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
