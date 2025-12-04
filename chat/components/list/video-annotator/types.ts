// Video annotation types for YouTube video timestamping

export interface VideoAnnotation {
  id: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  type: 'marker' | 'range';
}

// Alternative annotation type used by advanced timeline components
export interface TimestampAnnotation {
  id: string;
  timestamp: number;
  comment: string;
  transcriptBefore?: string;
  transcriptAfter?: string;
}

// Video section type for grouping annotations
export interface VideoSection {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  timestampIds: string[];
}

export interface AnnotationManagerProps {
  annotations: VideoAnnotation[];
  sections?: VideoSection[];
  currentTime: number;
  videoDuration: number;
  onAnnotationsChange: (annotations: VideoAnnotation[]) => void;
  onSeekTo: (time: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSectionClick?: (sectionId: string) => void;
  onSectionDelete?: (sectionId: string) => void;
  onSectionUpdate?: (sectionId: string, title: string) => void;
  onDeleteAnnotation?: (annotationId: string) => void;
  onQuickClip?: (duration: 10 | 30) => void;
  onCreateSection?: (startTime: number, endTime: number, timestampIds: string[]) => void;
}

export interface VideoPlayerProps {
  videoUrl: string;
  annotations?: VideoAnnotation[];
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  seekTo?: number;
  isLooping?: boolean;
  loopRange?: { start: number; end: number } | null;
}

// Helper to format time in MM:SS or HH:MM:SS format
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Adapter functions to convert between annotation formats
export function videoAnnotationToTimestamp(annotation: VideoAnnotation): TimestampAnnotation {
  return {
    id: annotation.id,
    timestamp: annotation.startTime,
    comment: `${annotation.title}${annotation.description ? ': ' + annotation.description : ''}`,
    transcriptBefore: '',
    transcriptAfter: ''
  };
}

export function timestampToVideoAnnotation(timestamp: TimestampAnnotation): VideoAnnotation {
  return {
    id: timestamp.id,
    title: timestamp.comment.split(':')[0] || timestamp.comment,
    description: timestamp.comment.split(':').slice(1).join(':').trim() || '',
    startTime: timestamp.timestamp,
    endTime: timestamp.timestamp,
    type: 'marker'
  };
}
