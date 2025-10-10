// Video annotation types for YouTube video timestamping

export interface VideoAnnotation {
  id: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  type: 'marker' | 'range';
}

export interface AnnotationManagerProps {
  annotations: VideoAnnotation[];
  currentTime: number;
  videoDuration: number;
  onAnnotationsChange: (annotations: VideoAnnotation[]) => void;
  onSeekTo: (time: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
}

export interface VideoPlayerProps {
  videoUrl: string;
  annotations?: VideoAnnotation[];
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  seekTo?: number;
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
