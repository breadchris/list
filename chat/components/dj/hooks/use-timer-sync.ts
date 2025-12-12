"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { usePlaybackActions } from "./use-dj-actions";

interface TimerSyncState {
  position: number;
  is_playing: boolean;
  playback_rate: number;
  current_duration: number;
}

interface UseTimerSyncReturn {
  play: () => void;
  pause: () => void;
  seek: (position: number) => void;
  setDuration: (duration: number) => void;
  setRate: (rate: number) => void;
  videoChanged: () => void;
  isConnected: boolean;
  serverState: TimerSyncState | null;
}

/**
 * Hook to sync video playback timing with Jamsocket session backend.
 * The server maintains authoritative time tracking that isn't affected
 * by browser tab throttling.
 */
export function useTimerSync(backendUrl: string | null): UseTimerSyncReturn {
  const socketRef = useRef<Socket | null>(null);
  const { nextVideo } = usePlaybackActions();
  const [isConnected, setIsConnected] = useState(false);
  const [serverState, setServerState] = useState<TimerSyncState | null>(null);

  useEffect(() => {
    if (!backendUrl) {
      setIsConnected(false);
      return;
    }

    console.log("[TimerSync] Connecting to backend:", backendUrl);
    const socket = io(backendUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[TimerSync] Connected to server");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[TimerSync] Disconnected from server");
      setIsConnected(false);
    });

    socket.on("video-ended", () => {
      // Server detected video end - trigger next video in Y-Sweet
      console.log("[TimerSync] Server detected video end, advancing to next");
      nextVideo();
    });

    socket.on("sync", (state: TimerSyncState) => {
      setServerState(state);
    });

    // Poll for time sync every 3 seconds as backup
    const interval = setInterval(() => {
      if (socket.connected) {
        socket.emit("get-time");
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [backendUrl, nextVideo]);

  const play = useCallback(() => {
    socketRef.current?.emit("play");
  }, []);

  const pause = useCallback(() => {
    socketRef.current?.emit("pause");
  }, []);

  const seek = useCallback((position: number) => {
    socketRef.current?.emit("seek", position);
  }, []);

  const setDuration = useCallback((duration: number) => {
    socketRef.current?.emit("set-duration", duration);
  }, []);

  const setRate = useCallback((rate: number) => {
    socketRef.current?.emit("set-rate", rate);
  }, []);

  const videoChanged = useCallback(() => {
    socketRef.current?.emit("video-changed");
  }, []);

  return {
    play,
    pause,
    seek,
    setDuration,
    setRate,
    videoChanged,
    isConnected,
    serverState,
  };
}

/**
 * No-op implementation when server timer is disabled.
 * Returns stable empty callbacks that do nothing.
 */
export function useNoOpTimerSync(): UseTimerSyncReturn {
  const noop = useCallback(() => {}, []);
  const noopWithArg = useCallback((_: number) => {}, []);

  return {
    play: noop,
    pause: noop,
    seek: noopWithArg,
    setDuration: noopWithArg,
    setRate: noopWithArg,
    videoChanged: noop,
    isConnected: false,
    serverState: null,
  };
}
