"use client";

import { useCallback, useRef } from "react";
import { useYDoc } from "@y-sweet/react";
import * as Y from "yjs";
import { nanoid } from "nanoid";
import type { AddVideoParams, ReorderParams } from "../types";
import { TIME_SYNC_DEBOUNCE_MS } from "../constants";

// Main actions hook
export function useDjActions() {
  const doc = useYDoc();
  const lastTimeSyncRef = useRef<number>(0);

  // Get queue array
  const getQueueArray = useCallback(() => {
    if (!doc) return null;
    const rootMap = doc.getMap("djState");
    return rootMap.get("queue") as Y.Array<Y.Map<unknown>> | null;
  }, [doc]);

  // Get playback map
  const getPlaybackMap = useCallback(() => {
    if (!doc) return null;
    const rootMap = doc.getMap("djState");
    return rootMap.get("playback") as Y.Map<unknown> | null;
  }, [doc]);

  // Add video to queue
  const addVideo = useCallback(
    ({ url, title, thumbnail, added_by }: AddVideoParams) => {
      if (!doc) return;
      const queueArray = getQueueArray();
      if (!queueArray) return;

      doc.transact(() => {
        const videoMap = new Y.Map();
        videoMap.set("id", nanoid());
        videoMap.set("url", url);
        videoMap.set("title", title || "Untitled Video");
        if (thumbnail) videoMap.set("thumbnail", thumbnail);
        if (added_by) videoMap.set("added_by", added_by);
        videoMap.set("added_at", Date.now());
        queueArray.push([videoMap]);
      });
    },
    [doc, getQueueArray]
  );

  // Remove video from queue
  const removeVideo = useCallback(
    (videoId: string) => {
      if (!doc) return;
      const queueArray = getQueueArray();
      const playbackMap = getPlaybackMap();
      if (!queueArray || !playbackMap) return;

      doc.transact(() => {
        // Find index of video to remove
        let removeIndex = -1;
        for (let i = 0; i < queueArray.length; i++) {
          const video = queueArray.get(i);
          if (video.get("id") === videoId) {
            removeIndex = i;
            break;
          }
        }

        if (removeIndex === -1) return;

        const currentIndex = playbackMap.get("current_index") as number;

        // Remove the video
        queueArray.delete(removeIndex, 1);

        // Adjust current index if needed
        if (removeIndex < currentIndex) {
          playbackMap.set("current_index", currentIndex - 1);
        } else if (removeIndex === currentIndex && currentIndex >= queueArray.length) {
          playbackMap.set("current_index", Math.max(0, queueArray.length - 1));
        }
      });
    },
    [doc, getQueueArray, getPlaybackMap]
  );

  // Reorder queue (drag-and-drop)
  const reorderQueue = useCallback(
    ({ old_index, new_index }: ReorderParams) => {
      if (!doc) return;
      const queueArray = getQueueArray();
      const playbackMap = getPlaybackMap();
      if (!queueArray || !playbackMap || old_index === new_index) return;

      doc.transact(() => {
        const currentIndex = playbackMap.get("current_index") as number;

        // Get the video to move
        const videoToMove = queueArray.get(old_index);
        if (!videoToMove) return;

        // Create a copy
        const newVideoMap = new Y.Map();
        newVideoMap.set("id", videoToMove.get("id"));
        newVideoMap.set("url", videoToMove.get("url"));
        newVideoMap.set("title", videoToMove.get("title"));
        const thumbnail = videoToMove.get("thumbnail");
        if (thumbnail) newVideoMap.set("thumbnail", thumbnail);
        const duration = videoToMove.get("duration");
        if (duration) newVideoMap.set("duration", duration);
        const addedBy = videoToMove.get("added_by");
        if (addedBy) newVideoMap.set("added_by", addedBy);
        newVideoMap.set("added_at", videoToMove.get("added_at"));

        // Remove and reinsert
        if (old_index < new_index) {
          queueArray.insert(new_index + 1, [newVideoMap]);
          queueArray.delete(old_index, 1);
        } else {
          queueArray.delete(old_index, 1);
          queueArray.insert(new_index, [newVideoMap]);
        }

        // Adjust current index
        if (old_index === currentIndex) {
          playbackMap.set("current_index", new_index);
        } else if (old_index < currentIndex && new_index >= currentIndex) {
          playbackMap.set("current_index", currentIndex - 1);
        } else if (old_index > currentIndex && new_index <= currentIndex) {
          playbackMap.set("current_index", currentIndex + 1);
        }
      });
    },
    [doc, getQueueArray, getPlaybackMap]
  );

  // Play specific video by index
  const playVideo = useCallback(
    (index: number) => {
      if (!doc) return;
      const playbackMap = getPlaybackMap();
      const queueArray = getQueueArray();
      if (!playbackMap || !queueArray) return;

      if (index < 0 || index >= queueArray.length) return;

      doc.transact(() => {
        playbackMap.set("current_index", index);
        playbackMap.set("current_time", 0);
        playbackMap.set("is_playing", true);
        playbackMap.set("last_updated", Date.now());
      });
    },
    [doc, getPlaybackMap, getQueueArray]
  );

  // Play next video
  const nextVideo = useCallback(() => {
    if (!doc) return;
    const playbackMap = getPlaybackMap();
    const queueArray = getQueueArray();
    if (!playbackMap || !queueArray) return;

    const currentIndex = playbackMap.get("current_index") as number;
    if (currentIndex >= queueArray.length - 1) return;

    doc.transact(() => {
      playbackMap.set("current_index", currentIndex + 1);
      playbackMap.set("current_time", 0);
      playbackMap.set("is_playing", true);
      playbackMap.set("last_updated", Date.now());
    });
  }, [doc, getPlaybackMap, getQueueArray]);

  // Play previous video
  const previousVideo = useCallback(() => {
    if (!doc) return;
    const playbackMap = getPlaybackMap();
    if (!playbackMap) return;

    const currentIndex = playbackMap.get("current_index") as number;
    if (currentIndex <= 0) return;

    doc.transact(() => {
      playbackMap.set("current_index", currentIndex - 1);
      playbackMap.set("current_time", 0);
      playbackMap.set("is_playing", true);
      playbackMap.set("last_updated", Date.now());
    });
  }, [doc, getPlaybackMap]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!doc) return;
    const playbackMap = getPlaybackMap();
    if (!playbackMap) return;

    doc.transact(() => {
      const isPlaying = playbackMap.get("is_playing") as boolean;
      playbackMap.set("is_playing", !isPlaying);
      playbackMap.set("last_updated", Date.now());
    });
  }, [doc, getPlaybackMap]);

  // Set playing state
  const setIsPlaying = useCallback(
    (isPlaying: boolean) => {
      if (!doc) return;
      const playbackMap = getPlaybackMap();
      if (!playbackMap) return;

      doc.transact(() => {
        playbackMap.set("is_playing", isPlaying);
        playbackMap.set("last_updated", Date.now());
      });
    },
    [doc, getPlaybackMap]
  );

  // Update current time (debounced to avoid flooding)
  const updateCurrentTime = useCallback(
    (time: number) => {
      if (!doc) return;
      const playbackMap = getPlaybackMap();
      if (!playbackMap) return;

      const now = Date.now();
      if (now - lastTimeSyncRef.current < TIME_SYNC_DEBOUNCE_MS) {
        return;
      }
      lastTimeSyncRef.current = now;

      doc.transact(() => {
        playbackMap.set("current_time", time);
        playbackMap.set("last_updated", now);
      });
    },
    [doc, getPlaybackMap]
  );

  // Seek to time (force update regardless of debounce)
  const seekTo = useCallback(
    (time: number) => {
      if (!doc) return;
      const playbackMap = getPlaybackMap();
      if (!playbackMap) return;

      lastTimeSyncRef.current = Date.now();

      doc.transact(() => {
        playbackMap.set("current_time", time);
        playbackMap.set("last_updated", Date.now());
      });
    },
    [doc, getPlaybackMap]
  );

  // Set volume
  const setVolume = useCallback(
    (volume: number) => {
      if (!doc) return;
      const playbackMap = getPlaybackMap();
      if (!playbackMap) return;

      playbackMap.set("volume", Math.max(0, Math.min(1, volume)));
    },
    [doc, getPlaybackMap]
  );

  // Set playback rate
  const setPlaybackRate = useCallback(
    (rate: number) => {
      if (!doc) return;
      const playbackMap = getPlaybackMap();
      if (!playbackMap) return;

      playbackMap.set("playback_rate", rate);
    },
    [doc, getPlaybackMap]
  );

  // Update video metadata (e.g., after fetching title/thumbnail)
  const updateVideoMetadata = useCallback(
    (videoId: string, metadata: { title?: string; thumbnail?: string; duration?: number }) => {
      if (!doc) return;
      const queueArray = getQueueArray();
      if (!queueArray) return;

      doc.transact(() => {
        for (let i = 0; i < queueArray.length; i++) {
          const video = queueArray.get(i);
          if (video.get("id") === videoId) {
            if (metadata.title) video.set("title", metadata.title);
            if (metadata.thumbnail) video.set("thumbnail", metadata.thumbnail);
            if (metadata.duration) video.set("duration", metadata.duration);
            break;
          }
        }
      });
    },
    [doc, getQueueArray]
  );

  return {
    // Queue actions
    addVideo,
    removeVideo,
    reorderQueue,
    updateVideoMetadata,

    // Playback actions
    playVideo,
    nextVideo,
    previousVideo,
    togglePlayPause,
    setIsPlaying,
    updateCurrentTime,
    seekTo,
    setVolume,
    setPlaybackRate,
  };
}

// Export individual action hooks for more granular usage
export function useQueueActions() {
  const { addVideo, removeVideo, reorderQueue, updateVideoMetadata } = useDjActions();
  return { addVideo, removeVideo, reorderQueue, updateVideoMetadata };
}

export function usePlaybackActions() {
  const {
    playVideo,
    nextVideo,
    previousVideo,
    togglePlayPause,
    setIsPlaying,
    updateCurrentTime,
    seekTo,
    setVolume,
    setPlaybackRate,
  } = useDjActions();
  return {
    playVideo,
    nextVideo,
    previousVideo,
    togglePlayPause,
    setIsPlaying,
    updateCurrentTime,
    seekTo,
    setVolume,
    setPlaybackRate,
  };
}
