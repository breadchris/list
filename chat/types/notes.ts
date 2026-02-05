/**
 * Types for Notes App with Electric SQL + Yjs
 * Uses existing content table - no migration required
 */

/**
 * Note metadata stored in content.metadata
 */
export interface NoteMetadata {
  yjs_state?: string; // base64 encoded Y.Doc state
  client_id?: string; // Last client to update
}

/**
 * A note stored as a content row
 */
export interface NoteContent {
  id: string;
  type: "note";
  data: string; // Note title
  metadata: NoteMetadata | null;
  group_id: string;
  user_id: string;
  parent_content_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Note collaborator for UI display (from Realtime Presence)
 */
export interface NoteCollaborator {
  user_id: string;
  user_name: string;
  user_color: string;
  presence_ref: string;
}

/**
 * Electric SQL sync status
 */
export type ElectricSyncStatus = "connecting" | "synced" | "offline" | "error";

/**
 * Presence state for Supabase Realtime
 */
export interface NotePresenceState {
  user_id: string;
  user_name: string;
  user_color: string;
  note_id: string;
}
