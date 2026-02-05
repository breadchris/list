"use client";

import { useCallback, useState, useEffect } from "react";
import { useSupabase } from "@/components/providers";
import type { NoteContent } from "@/types/notes";

interface UseNotesOptions {
  group_id: string | null;
}

interface UseNotesReturn {
  notes: NoteContent[];
  isLoading: boolean;
  createNote: (title?: string) => Promise<NoteContent | null>;
  updateNote: (noteId: string, updates: Partial<Pick<NoteContent, "data" | "metadata">>) => Promise<boolean>;
  deleteNote: (noteId: string) => Promise<boolean>;
}

export function useNotes({ group_id }: UseNotesOptions): UseNotesReturn {
  const supabase = useSupabase();
  const [notes, setNotes] = useState<NoteContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch notes for the group (content rows with type="note")
  useEffect(() => {
    if (!group_id) {
      setNotes([]);
      setIsLoading(false);
      return;
    }

    const fetchNotes = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("type", "note")
        .eq("group_id", group_id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch notes:", error);
      } else {
        setNotes((data || []) as NoteContent[]);
      }
      setIsLoading(false);
    };

    fetchNotes();

    // Subscribe to realtime updates for notes in this group
    const channel = supabase
      .channel(`notes:${group_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "content",
          filter: `group_id=eq.${group_id}`,
        },
        (payload) => {
          // Only handle note type
          const newRecord = payload.new as { type?: string } | undefined;
          const oldRecord = payload.old as { type?: string; id?: string } | undefined;

          if (newRecord && newRecord.type !== "note") return;
          if (oldRecord && oldRecord.type !== "note") return;

          if (payload.eventType === "INSERT" && newRecord) {
            setNotes((prev) => [newRecord as NoteContent, ...prev]);
          } else if (payload.eventType === "UPDATE" && newRecord) {
            setNotes((prev) =>
              prev.map((n) =>
                n.id === (newRecord as NoteContent).id ? (newRecord as NoteContent) : n
              )
            );
          } else if (payload.eventType === "DELETE" && oldRecord?.id) {
            setNotes((prev) => prev.filter((n) => n.id !== oldRecord.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, group_id]);

  const createNote = useCallback(
    async (title = "Untitled"): Promise<NoteContent | null> => {
      if (!group_id) return null;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        console.error("User not authenticated");
        return null;
      }

      const { data, error } = await supabase
        .from("content")
        .insert({
          type: "note",
          data: title,
          group_id,
          user_id: userData.user.id,
          metadata: {},
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to create note:", error);
        return null;
      }

      return data as NoteContent;
    },
    [supabase, group_id]
  );

  const updateNote = useCallback(
    async (noteId: string, updates: Partial<Pick<NoteContent, "data" | "metadata">>): Promise<boolean> => {
      const { error } = await supabase
        .from("content")
        .update(updates)
        .eq("id", noteId)
        .eq("type", "note");

      if (error) {
        console.error("Failed to update note:", error);
        return false;
      }

      return true;
    },
    [supabase]
  );

  const deleteNote = useCallback(
    async (noteId: string): Promise<boolean> => {
      const { error } = await supabase
        .from("content")
        .delete()
        .eq("id", noteId)
        .eq("type", "note");

      if (error) {
        console.error("Failed to delete note:", error);
        return false;
      }

      return true;
    },
    [supabase]
  );

  return {
    notes,
    isLoading,
    createNote,
    updateNote,
    deleteNote,
  };
}
