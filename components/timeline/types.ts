// Timeline content type for tracking moments in time-based media
// Similar to iOS Voice Memos interface

export interface TimelineMarker {
  id: string;
  time: number; // seconds
  label?: string;
  note?: string;
  created_at: string;
}

export interface TimelineMetadata {
  duration: number; // total duration in seconds
  current_time: number; // playback position in seconds
  markers: TimelineMarker[];
  context?: string; // e.g., "Movie: The Matrix", "Podcast: Episode 42"
  is_playing?: boolean; // playback state
  created_at?: string;
  updated_at?: string;
}

export interface TimelinePlayerProps {
  contentId: string;
  title: string;
  metadata: TimelineMetadata;
  onUpdate: (metadata: TimelineMetadata) => void;
  onClose?: () => void;
}

export interface TimelineControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSkipBackward: (seconds: number) => void;
  onSkipForward: (seconds: number) => void;
  onMark: () => void;
  disabled?: boolean;
}

export interface TimelineMarkerListProps {
  markers: TimelineMarker[];
  currentTime: number;
  onMarkerClick: (time: number) => void;
  onMarkerUpdate: (marker: TimelineMarker) => void;
  onMarkerDelete: (markerId: string) => void;
}

// Helper to format time in MM:SS.SS or HH:MM:SS.SS format (iOS Voice Memos style)
export const formatTimelineTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
};

// Simpler format without centiseconds for markers
export const formatMarkerTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
