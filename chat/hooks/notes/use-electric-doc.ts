"use client";

import { useState, useEffect, useRef } from "react";
import * as Y from "yjs";
import { ElectricProvider } from "@/lib/notes/y-electric-provider";
import { useSupabase } from "@/components/providers";
import type { ElectricSyncStatus, NoteCollaborator, NotePresenceState } from "@/types/notes";

interface UseElectricDocOptions {
  note_id: string;
  electric_url: string;
  source_id: string;
  api_endpoint: string;
  user_name: string;
  user_color: string;
  user_id: string;
}

interface UseElectricDocReturn {
  doc: Y.Doc | null;
  provider: ElectricProvider | null;
  syncStatus: ElectricSyncStatus;
  collaborators: NoteCollaborator[];
}

export function useElectricDoc({
  note_id,
  electric_url,
  source_id,
  api_endpoint,
  user_name,
  user_color,
  user_id,
}: UseElectricDocOptions): UseElectricDocReturn {
  const supabase = useSupabase();
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<ElectricProvider | null>(null);
  const [syncStatus, setSyncStatus] = useState<ElectricSyncStatus>("connecting");
  const [collaborators, setCollaborators] = useState<NoteCollaborator[]>([]);
  const providerRef = useRef<ElectricProvider | null>(null);

  // Set up Electric provider for Yjs sync
  useEffect(() => {
    const ydoc = new Y.Doc();
    setDoc(ydoc);

    const electricProvider = new ElectricProvider(ydoc, {
      electric_url,
      source_id,
      note_id,
      api_endpoint,
    });

    providerRef.current = electricProvider;
    setProvider(electricProvider);

    // Listen for sync events
    electricProvider.on("status", ({ connected }) => {
      setSyncStatus(connected ? "synced" : "offline");
    });

    electricProvider.on("synced", () => {
      setSyncStatus("synced");
    });

    return () => {
      electricProvider.destroy();
      ydoc.destroy();
    };
  }, [note_id, electric_url, source_id, api_endpoint]);

  // Set up Supabase Realtime Presence for collaborators
  useEffect(() => {
    const channel = supabase.channel(`note-presence:${note_id}`, {
      config: {
        presence: {
          key: user_id,
        },
      },
    });

    // Track presence state
    const presenceState: NotePresenceState = {
      user_id,
      user_name,
      user_color,
      note_id,
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<NotePresenceState>();
        const collabs: NoteCollaborator[] = [];

        Object.entries(state).forEach(([key, presences]) => {
          if (key !== user_id && presences.length > 0) {
            const presence = presences[0];
            collabs.push({
              user_id: presence.user_id,
              user_name: presence.user_name || "Anonymous",
              user_color: presence.user_color || "#888",
              presence_ref: key,
            });
          }
        });

        setCollaborators(collabs);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(presenceState);
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [supabase, note_id, user_id, user_name, user_color]);

  return { doc, provider, syncStatus, collaborators };
}
