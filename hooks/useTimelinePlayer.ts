import { useState, useEffect, useRef, useCallback } from 'react';
import type { TimelineMarker, TimelineMetadata } from '../components/timeline/types';

interface UseTimelinePlayerOptions {
  initialMetadata: TimelineMetadata;
  onUpdate: (metadata: TimelineMetadata) => void;
  autoSave?: boolean; // Auto-save changes to database
  autoSaveDelay?: number; // Delay before auto-saving (ms)
}

export function useTimelinePlayer({
  initialMetadata,
  onUpdate,
  autoSave = true,
  autoSaveDelay = 1000,
}: UseTimelinePlayerOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialMetadata.current_time || 0);
  const [duration, setDuration] = useState(initialMetadata.duration);
  const [markers, setMarkers] = useState<TimelineMarker[]>(initialMetadata.markers || []);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  // Update duration if it changes externally
  useEffect(() => {
    setDuration(initialMetadata.duration);
  }, [initialMetadata.duration]);

  // Auto-save metadata changes
  const saveMetadata = useCallback(() => {
    const updatedMetadata: TimelineMetadata = {
      ...initialMetadata,
      current_time: currentTime,
      duration,
      markers,
      is_playing: isPlaying,
      updated_at: new Date().toISOString(),
    };
    onUpdate(updatedMetadata);
  }, [currentTime, duration, markers, isPlaying, initialMetadata, onUpdate]);

  // Debounced auto-save
  useEffect(() => {
    if (!autoSave) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      saveMetadata();
    }, autoSaveDelay);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [currentTime, markers, autoSave, autoSaveDelay, saveMetadata]);

  // Playback timer
  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = Date.now() - currentTime * 1000;

      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;

        if (elapsed >= duration) {
          setCurrentTime(duration);
          setIsPlaying(false);
        } else {
          setCurrentTime(elapsed);
        }
      }, 10); // Update every 10ms for smooth playback

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      pausedAtRef.current = currentTime;
    }
  }, [isPlaying, duration, currentTime]);

  const play = useCallback(() => {
    if (currentTime >= duration) {
      setCurrentTime(0); // Reset to start if at end
    }
    setIsPlaying(true);
  }, [currentTime, duration]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seekTo = useCallback((time: number) => {
    const newTime = Math.max(0, Math.min(time, duration));
    setCurrentTime(newTime);
    if (isPlaying) {
      startTimeRef.current = Date.now() - newTime * 1000;
    }
  }, [duration, isPlaying]);

  const skipForward = useCallback((seconds: number) => {
    seekTo(currentTime + seconds);
  }, [currentTime, seekTo]);

  const skipBackward = useCallback((seconds: number) => {
    seekTo(currentTime - seconds);
  }, [currentTime, seekTo]);

  const addMarker = useCallback((time?: number, label?: string, note?: string) => {
    const markerTime = time !== undefined ? time : currentTime;
    const newMarker: TimelineMarker = {
      id: `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      time: markerTime,
      label,
      note,
      created_at: new Date().toISOString(),
    };
    setMarkers(prev => [...prev, newMarker].sort((a, b) => a.time - b.time));
    return newMarker;
  }, [currentTime]);

  const updateMarker = useCallback((markerId: string, updates: Partial<TimelineMarker>) => {
    setMarkers(prev =>
      prev.map(marker =>
        marker.id === markerId ? { ...marker, ...updates } : marker
      ).sort((a, b) => a.time - b.time)
    );
  }, []);

  const deleteMarker = useCallback((markerId: string) => {
    setMarkers(prev => prev.filter(marker => marker.id !== markerId));
  }, []);

  const jumpToMarker = useCallback((markerId: string) => {
    const marker = markers.find(m => m.id === markerId);
    if (marker) {
      seekTo(marker.time);
    }
  }, [markers, seekTo]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const setDurationManually = useCallback((newDuration: number) => {
    setDuration(Math.max(0, newDuration));
    if (currentTime > newDuration) {
      setCurrentTime(newDuration);
    }
  }, [currentTime]);

  return {
    // State
    isPlaying,
    currentTime,
    duration,
    markers,

    // Playback controls
    play,
    pause,
    togglePlayPause,
    seekTo,
    skipForward,
    skipBackward,
    reset,

    // Marker management
    addMarker,
    updateMarker,
    deleteMarker,
    jumpToMarker,

    // Manual duration control
    setDuration: setDurationManually,

    // Manual save
    saveMetadata,
  };
}
