"use client";

import { useMemo, useSyncExternalStore, useCallback, useRef } from "react";
import { useYDoc } from "@y-sweet/react";
import * as Y from "yjs";
import type { Video, PlaybackState, DjState, VideoWithSection } from "../types";
import { DEFAULT_VOLUME, DEFAULT_PLAYBACK_RATE } from "../constants";

// Hook to subscribe to Y.js document changes
function useYjsSubscription(doc: Y.Doc | null) {
  const snapshotRef = useRef<unknown>(null);
  const snapshotJsonRef = useRef<string>("");

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!doc) return () => {};
      const rootMap = doc.getMap("djState");

      const handler = () => {
        const newJson = JSON.stringify(rootMap.toJSON());
        if (newJson !== snapshotJsonRef.current) {
          snapshotJsonRef.current = newJson;
          snapshotRef.current = rootMap.toJSON();
          callback();
        }
      };

      rootMap.observeDeep(handler);

      // Initialize snapshot
      snapshotJsonRef.current = JSON.stringify(rootMap.toJSON());
      snapshotRef.current = rootMap.toJSON();

      return () => rootMap.unobserveDeep(handler);
    },
    [doc]
  );

  const getSnapshot = useCallback(() => {
    return snapshotRef.current;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Helper to safely get Y.Map values
function getMapValue<T>(
  map: Y.Map<unknown> | undefined,
  key: string,
  defaultValue: T
): T {
  if (!map) return defaultValue;
  const value = map.get(key);
  return value !== undefined ? (value as T) : defaultValue;
}

// Default state factory
function getDefaultState(): DjState {
  return {
    queue: [],
    playback: {
      current_index: 0,
      is_playing: false,
      current_time: 0,
      volume: DEFAULT_VOLUME,
      playback_rate: DEFAULT_PLAYBACK_RATE,
      last_updated: Date.now(),
    },
  };
}

// Main DJ state hook
export function useDjState() {
  const doc = useYDoc();
  const snapshot = useYjsSubscription(doc);

  const state = useMemo((): DjState => {
    if (!doc || !snapshot) {
      return getDefaultState();
    }

    const rootMap = doc.getMap("djState");
    const queueArray = rootMap.get("queue") as Y.Array<Y.Map<unknown>> | undefined;
    const playbackMap = rootMap.get("playback") as Y.Map<unknown> | undefined;

    // Extract queue
    const queue: Video[] = [];
    if (queueArray) {
      queueArray.forEach((videoMap) => {
        queue.push({
          id: videoMap.get("id") as string,
          url: videoMap.get("url") as string,
          title: videoMap.get("title") as string,
          thumbnail: videoMap.get("thumbnail") as string | undefined,
          duration: videoMap.get("duration") as number | undefined,
          added_by: videoMap.get("added_by") as string | undefined,
          added_at: videoMap.get("added_at") as number,
        });
      });
    }

    // Extract playback state
    const playback: PlaybackState = {
      current_index: getMapValue(playbackMap, "current_index", 0),
      is_playing: getMapValue(playbackMap, "is_playing", false),
      current_time: getMapValue(playbackMap, "current_time", 0),
      volume: getMapValue(playbackMap, "volume", DEFAULT_VOLUME),
      playback_rate: getMapValue(playbackMap, "playback_rate", DEFAULT_PLAYBACK_RATE),
      last_updated: getMapValue(playbackMap, "last_updated", Date.now()),
      updated_by: getMapValue(playbackMap, "updated_by", undefined),
    };

    return { queue, playback };
  }, [doc, snapshot]);

  return { state, doc };
}

// Hook for queue only
export function useQueue(): Video[] {
  const { state } = useDjState();
  return state.queue;
}

// Hook for playback state only
export function usePlaybackState(): PlaybackState {
  const { state } = useDjState();
  return state.playback;
}

// Hook for current video
export function useCurrentVideo(): Video | null {
  const { state } = useDjState();
  const { queue, playback } = state;
  return queue[playback.current_index] || null;
}

// Hook for current index
export function useCurrentIndex(): number {
  const { state } = useDjState();
  return state.playback.current_index;
}

// Hook for is playing
export function useIsPlaying(): boolean {
  const { state } = useDjState();
  return state.playback.is_playing;
}

// Hook for queue with section info
export function useQueueWithSections(): VideoWithSection[] {
  const { state } = useDjState();
  const { queue, playback } = state;
  const currentIndex = playback.current_index;

  return queue.map((video, index) => {
    let section: VideoWithSection["section"];
    if (index < currentIndex) {
      section = "played";
    } else if (index === currentIndex) {
      section = "current";
    } else {
      section = "upcoming";
    }

    return {
      ...video,
      section,
      queue_index: index,
    };
  });
}

// Hook for upcoming videos (for drag-and-drop)
export function useUpcomingVideos(): VideoWithSection[] {
  const queueWithSections = useQueueWithSections();
  return queueWithSections.filter((v) => v.section === "upcoming");
}

// Hook to check if there's a next video
export function useHasNext(): boolean {
  const { state } = useDjState();
  return state.playback.current_index < state.queue.length - 1;
}

// Hook to check if there's a previous video
export function useHasPrevious(): boolean {
  const { state } = useDjState();
  return state.playback.current_index > 0;
}

// Hook for volume
export function useVolume(): number {
  const { state } = useDjState();
  return state.playback.volume;
}

// Hook for playback rate
export function usePlaybackRate(): number {
  const { state } = useDjState();
  return state.playback.playback_rate;
}
