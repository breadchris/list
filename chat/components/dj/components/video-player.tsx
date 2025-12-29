"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactPlayer from "react-player";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  RotateCcw,
  X,
} from "lucide-react";
import type { Video } from "../types";
import {
  CONTROLS_HIDE_DELAY,
  PLAYBACK_RATES,
  SYNC_THRESHOLD_SECONDS,
} from "../constants";
import {
  usePlaybackState,
  useHasNext,
  useHasPrevious,
} from "../hooks/use-dj-state";
import { usePlaybackActions, useQueueActions } from "../hooks/use-dj-actions";
import { useTimerSync, useNoOpTimerSync } from "../hooks/use-timer-sync";
import { useExtensionPlayer, useNoOpExtensionPlayer } from "../hooks/use-extension-player";
import { getFeatureFlag } from "@/utils/featureFlags";

// Format time as MM:SS or HH:MM:SS
function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface VideoPlayerProps {
  video: Video | null;
  /** URL for Jamsocket timer backend (only used when enableServerTimer flag is on) */
  timerBackendUrl?: string | null;
}

export function VideoPlayer({ video, timerBackendUrl }: VideoPlayerProps) {
  const playbackState = usePlaybackState();
  const hasNext = useHasNext();
  const hasPrevious = useHasPrevious();
  const {
    nextVideo,
    previousVideo,
    togglePlayPause,
    setIsPlaying,
    updateCurrentTime,
    seekTo,
    setPlaybackRate,
  } = usePlaybackActions();
  const { removeVideo } = useQueueActions();

  // Feature flag for server-side timer
  const useServerTimer = getFeatureFlag("enableServerTimer");

  // Use server timer sync if enabled, otherwise no-op
  const timerSync = useServerTimer
    ? useTimerSync(timerBackendUrl ?? null)
    : useNoOpTimerSync();

  // Use extension player for reliable background playback (Chrome only)
  // Only enable if server timer is not being used
  const extensionPlayer = !useServerTimer
    ? useExtensionPlayer({ enabled: true, debug: false })
    : useNoOpExtensionPlayer();

  const [duration, setDuration] = useState(0);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const playerRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const lastSyncedTimeRef = useRef<number>(0);
  // Track video index we've already triggered completion for (prevents double-trigger across clients)
  const completionDetectedForIndexRef = useRef<number | null>(null);

  // Extract values from synced state
  const { is_playing, current_time, volume, playback_rate } = playbackState;

  // Validate YouTube URL
  const isValidUrl = video?.url
    ? (ReactPlayer.canPlay?.(video.url) ?? false)
    : false;

  // Sync with remote playback time
  useEffect(() => {
    if (!playerRef.current || !isReady) return;

    const timeDiff = Math.abs(current_time - localCurrentTime);
    if (
      timeDiff > SYNC_THRESHOLD_SECONDS &&
      current_time !== lastSyncedTimeRef.current
    ) {
      playerRef.current.currentTime = current_time;
      setLocalCurrentTime(current_time);
      lastSyncedTimeRef.current = current_time;
    }
  }, [current_time, localCurrentTime, isReady]);

  // Reset when video changes
  useEffect(() => {
    setIsLoading(true);
    setIsReady(false);
    setError(null);
    setDuration(0);
    setLocalCurrentTime(0);
    setBufferedTime(0);
    lastSyncedTimeRef.current = 0;
    completionDetectedForIndexRef.current = null;
    seekTo(0);
  }, [video?.id, seekTo]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Detect video completion based on time (client-side fallback when server timer is disabled)
  // When server timer is enabled, the server handles video end detection
  // When extension player is active, the extension handles video end detection
  useEffect(() => {
    // Skip client-side detection when server timer is handling it
    if (useServerTimer) return;

    // Skip client-side detection when extension player is handling it
    if (extensionPlayer.isAvailable && extensionPlayer.isInitialized) return;

    if (!duration || duration <= 0 || !is_playing) return;

    const currentIndex = playbackState.current_index;

    // Already detected completion for this video index
    if (completionDetectedForIndexRef.current === currentIndex) return;

    // Check if we're within 1 second of the end
    const timeRemaining = duration - localCurrentTime;
    if (timeRemaining <= 1 && timeRemaining >= 0) {
      completionDetectedForIndexRef.current = currentIndex;

      if (hasNext) {
        nextVideo();
      } else {
        setIsPlaying(false);
      }
    }
  }, [useServerTimer, extensionPlayer, localCurrentTime, duration, is_playing, playbackState.current_index, hasNext, nextVideo, setIsPlaying]);

  // Sync duration with server timer when it changes
  useEffect(() => {
    if (useServerTimer && duration > 0) {
      timerSync.setDuration(duration);
    }
  }, [useServerTimer, duration, timerSync]);

  // Notify server timer when video changes
  useEffect(() => {
    if (useServerTimer) {
      timerSync.videoChanged();
    }
  }, [useServerTimer, video?.id, timerSync]);

  // Initialize extension player on mount
  useEffect(() => {
    if (extensionPlayer.isAvailable && !extensionPlayer.isInitialized) {
      extensionPlayer.init();
    }
  }, [extensionPlayer]);

  // Sync video with extension player when video changes
  useEffect(() => {
    if (extensionPlayer.isAvailable && extensionPlayer.isInitialized && video?.url) {
      extensionPlayer.loadVideo(video.url, current_time);
    }
  }, [extensionPlayer, video?.url, video?.id]);

  // Sync play state with extension player
  useEffect(() => {
    if (extensionPlayer.isAvailable && extensionPlayer.isInitialized) {
      if (is_playing) {
        extensionPlayer.play();
      } else {
        extensionPlayer.pause();
      }
    }
  }, [extensionPlayer, is_playing]);

  // Handle player ready
  const handleReady = useCallback(() => {
    setIsReady(true);
    setIsLoading(false);
    setError(null);
    // Get duration from the video element
    if (playerRef.current && playerRef.current.duration) {
      setDuration(playerRef.current.duration);
    }
    // Handle autoplay policy: if shared state says playing but browser blocks it,
    // try to play and catch the error to reset state
    if (is_playing && playerRef.current) {
      playerRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [is_playing, setIsPlaying]);

  // Handle play state changes
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    if (useServerTimer) {
      timerSync.play();
    }
  }, [setIsPlaying, useServerTimer, timerSync]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (useServerTimer) {
      timerSync.pause();
    }
  }, [setIsPlaying, useServerTimer, timerSync]);

  // Handle time updates (v3 uses standard HTMLMediaElement events)
  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const target = e.currentTarget;
      if (target.currentTime !== undefined && !isNaN(target.currentTime)) {
        setLocalCurrentTime(target.currentTime);
        updateCurrentTime(target.currentTime);
      }
      // Update buffered time
      if (target.buffered && target.buffered.length > 0) {
        setBufferedTime(target.buffered.end(target.buffered.length - 1));
      }
      // Fallback: get duration if not already set
      if (duration === 0 && target.duration && !isNaN(target.duration)) {
        setDuration(target.duration);
      }
    },
    [updateCurrentTime, duration],
  );

  // Handle duration change
  const handleDurationChange = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const dur = e.currentTarget.duration;
      if (dur && !isNaN(dur) && dur > 0) {
        setDuration(dur);
      }
    },
    [],
  );

  // Handle player error
  const handleError = useCallback(() => {
    setError("Failed to load video. Please check the URL.");
    setIsLoading(false);
  }, []);

  // Handle video end
  const handleEnded = useCallback(() => {
    if (hasNext) {
      nextVideo();
    } else {
      setIsPlaying(false);
    }
  }, [hasNext, nextVideo, setIsPlaying]);

  // Handle play/pause toggle
  const handlePlayPause = useCallback(() => {
    togglePlayPause();
  }, [togglePlayPause]);

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Handle restart
  const handleRestart = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.currentTime = 0;
      setLocalCurrentTime(0);
      seekTo(0);
    }
  }, [seekTo]);

  // Handle playback speed change
  const handlePlaybackRateChange = useCallback(
    (rate: number) => {
      setPlaybackRate(rate);
      setShowSpeedMenu(false);
      if (useServerTimer) {
        timerSync.setRate(rate);
      }
      // Sync to extension player
      if (extensionPlayer.isAvailable && extensionPlayer.isInitialized) {
        extensionPlayer.setRate(rate);
      }
    },
    [setPlaybackRate, useServerTimer, timerSync, extensionPlayer],
  );

  // Handle seek
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!playerRef.current || duration <= 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const seekTime = percentage * duration;
      playerRef.current.currentTime = seekTime;
      setLocalCurrentTime(seekTime);
      seekTo(seekTime);
      if (useServerTimer) {
        timerSync.seek(seekTime);
      }
      // Sync to extension player
      if (extensionPlayer.isAvailable && extensionPlayer.isInitialized) {
        extensionPlayer.seek(seekTime);
      }
    },
    [duration, seekTo, useServerTimer, timerSync, extensionPlayer],
  );

  // Handle controls visibility
  const handleShowControls = useCallback(() => {
    setShowControls(true);

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    if (is_playing) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, CONTROLS_HIDE_DELAY);
    }
  }, [is_playing]);

  // Show controls when paused
  useEffect(() => {
    if (!is_playing) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      handleShowControls();
    }
  }, [is_playing, handleShowControls]);

  // No video state
  if (!video) {
    return (
      <div className="aspect-video bg-neutral-900 flex items-center justify-center rounded-lg">
        <div className="text-center p-4 md:p-8">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
            <Play className="h-6 w-6 md:h-8 md:w-8 text-neutral-500" />
          </div>
          <h3 className="text-base md:text-lg font-medium text-neutral-300 mb-2">
            No Video Selected
          </h3>
          <p className="text-xs md:text-sm text-neutral-500 hidden md:block">
            Press Cmd+K to add a video to the queue
          </p>
          <p className="text-xs text-neutral-500 md:hidden">
            Tap + to add a video to the queue
          </p>
        </div>
      </div>
    );
  }

  // Invalid URL state
  if (!isValidUrl) {
    return (
      <div className="aspect-video bg-neutral-900 flex items-center justify-center rounded-lg">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="h-8 w-8 text-neutral-500" />
          </div>
          <h3 className="text-lg font-medium text-neutral-300 mb-2">
            Invalid Video URL
          </h3>
          <p className="text-sm text-neutral-500">
            Please enter a valid YouTube URL
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="aspect-video bg-red-950/30 flex items-center justify-center rounded-lg">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-red-300 mb-2">Video Error</h3>
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              setIsReady(false);
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={videoContainerRef}
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden cursor-pointer"
      onMouseMove={handleShowControls}
      onTouchStart={handleShowControls}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-neutral-700 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-neutral-300 mb-4">Loading video...</p>
            <button
              onClick={() => {
                setIsLoading(false);
                setIsReady(true);
                // Call play directly in click handler to satisfy autoplay policy
                // In v3, playerRef.current IS the HTMLVideoElement
                playerRef.current?.play();
                setIsPlaying(true);
              }}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <Play className="h-4 w-4" />
              Click to Play
            </button>
          </div>
        </div>
      )}

      {/* ReactPlayer v3 - uses HTMLMediaElement interface */}
      <ReactPlayer
        ref={playerRef}
        src={video.url}
        width="100%"
        height="100%"
        playing={is_playing}
        volume={isMuted ? 0 : volume}
        muted={isMuted}
        playbackRate={playback_rate}
        controls={false}
        onReady={handleReady}
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onError={handleError}
        onEnded={handleEnded}
        config={{
          youtube: {
            playerVars: {
              showinfo: 0,
              modestbranding: 1,
              rel: 0,
              enablejsapi: 1,
              origin: "http://localhost:3000",
              // typeof window !== "undefined" ? window.location.origin : "",
            },
          },
        }}
        style={{
          display: isLoading ? "none" : "block",
          backgroundColor: "#000000",
        }}
      />

      {/* Custom Controls Overlay */}
      {!isLoading && !error && isReady && (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 md:p-4 z-10 transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Video title */}
          <div className="mb-2 md:mb-3">
            <p className="text-white font-medium truncate text-sm md:text-base">{video.title}</p>
          </div>

          <div className="flex items-center gap-1.5 md:gap-3">
            {/* Previous */}
            <button
              onClick={previousVideo}
              disabled={!hasPrevious}
              className="text-white hover:bg-white/20 active:bg-white/30 p-1.5 md:p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
            >
              <SkipBack className="h-4 w-4 md:h-5 md:w-5" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className="text-white hover:bg-white/20 active:bg-white/30 p-1.5 md:p-2 rounded-lg transition-colors touch-manipulation"
            >
              {is_playing ? (
                <Pause className="h-5 w-5 md:h-6 md:w-6" />
              ) : (
                <Play className="h-5 w-5 md:h-6 md:w-6" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={nextVideo}
              disabled={!hasNext}
              className="text-white hover:bg-white/20 active:bg-white/30 p-1.5 md:p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
            >
              <SkipForward className="h-4 w-4 md:h-5 md:w-5" />
            </button>

            {/* Restart - hidden on mobile to save space */}
            <button
              onClick={handleRestart}
              className="hidden md:block text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Time display */}
            <div className="flex-1 text-white text-xs md:text-sm min-w-0">
              <span className="tabular-nums">{formatTime(localCurrentTime)}</span>
              <span className="text-white/60"> / </span>
              <span className="tabular-nums">{formatTime(duration)}</span>
            </div>

            {/* Playback Speed Control - hidden on very small screens */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="text-white hover:bg-white/20 px-2 md:px-3 py-1.5 md:py-2 rounded-lg transition-colors text-xs md:text-sm font-medium"
              >
                {playback_rate}x
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-black/90 rounded-lg shadow-lg overflow-hidden backdrop-blur-sm">
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handlePlaybackRateChange(rate)}
                      className={`block w-full px-4 py-2 text-left text-white hover:bg-white/20 transition-colors text-sm touch-manipulation ${
                        playback_rate === rate ? "bg-white/10" : ""
                      }`}
                    >
                      {rate}x {playback_rate === rate && "✓"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Volume */}
            <button
              onClick={handleMuteToggle}
              className="text-white hover:bg-white/20 active:bg-white/30 p-1.5 md:p-2 rounded-lg transition-colors touch-manipulation"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4 md:h-5 md:w-5" />
              ) : (
                <Volume2 className="h-4 w-4 md:h-5 md:w-5" />
              )}
            </button>
          </div>

          {/* Progress Bar - larger touch target on mobile */}
          {duration > 0 && (
            <div className="mt-2 md:mt-3 py-1">
              <div
                className="w-full bg-white/30 rounded-full h-2 md:h-1.5 md:hover:h-2.5 relative cursor-pointer transition-all group touch-manipulation"
                onClick={handleSeek}
              >
                {/* Buffered */}
                <div
                  className="absolute top-0 left-0 h-full bg-white/50 rounded-full transition-all pointer-events-none z-0"
                  style={{ width: `${(bufferedTime / duration) * 100}%` }}
                />
                {/* Progress */}
                <div
                  className="absolute top-0 left-0 h-full bg-violet-500 rounded-full transition-all pointer-events-none z-10"
                  style={{ width: `${(localCurrentTime / duration) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
