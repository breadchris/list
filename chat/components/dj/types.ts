// Video in the queue
export interface Video {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  added_by?: string;
  added_at: number;
}

// Playback state synced across users
export interface PlaybackState {
  current_index: number;
  is_playing: boolean;
  current_time: number;
  volume: number;
  playback_rate: number;
  last_updated: number;
  updated_by?: string;
}

// Full DJ state structure
export interface DjState {
  queue: Video[];
  playback: PlaybackState;
}

// Queue section types
export type QueueSection = "played" | "current" | "upcoming";

// Video with section info for rendering
export interface VideoWithSection extends Video {
  section: QueueSection;
  queue_index: number;
}

// Add video parameters
export interface AddVideoParams {
  url: string;
  title?: string;
  thumbnail?: string;
  added_by?: string;
}

// Reorder parameters
export interface ReorderParams {
  old_index: number;
  new_index: number;
}
