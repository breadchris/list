import { useState, useEffect, useRef, useCallback } from "react";
import ReactPlayer from "react-player";
import { VideoPlayerProps, formatTime } from "./types";

export function VideoPlayer({
  videoUrl,
  annotations = [],
  onTimeUpdate,
  onDurationChange,
  onPlayStateChange,
  seekTo,
  isLooping = false,
  loopRange = null,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const playerRef = useRef<ReactPlayer>(null);
  const timeUpdateInterval = useRef<number | null>(null);
  const lastSeekTo = useRef<number | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Validate YouTube URL
  const isValidYouTubeUrl = ReactPlayer.canPlay(videoUrl);

  // Start time update loop
  const startTimeUpdateLoop = useCallback(() => {
    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current);
    }

    timeUpdateInterval.current = window.setInterval(() => {
      if (playerRef.current && isReady) {
        try {
          const current = playerRef.current.currentTime;
          const loaded = playerRef.current.buffered.length > 0
            ? playerRef.current.buffered.end(playerRef.current.buffered.length - 1)
            : 0;

          // Only update if current time is a valid number
          if (typeof current === 'number' && !isNaN(current)) {
            setCurrentTime(current);
            setBufferedTime(loaded);
            onTimeUpdate(current);
          }
        } catch (error) {
          console.warn("Time update error:", error);
        }
      }
    }, 100);
  }, [isReady, onTimeUpdate]);

  const stopTimeUpdateLoop = useCallback(() => {
    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current);
      timeUpdateInterval.current = null;
    }
  }, []);

  // Handle external seek requests
  useEffect(() => {
    if (
      seekTo !== undefined &&
      seekTo !== null &&
      seekTo !== lastSeekTo.current &&
      playerRef.current &&
      isReady
    ) {
      try {
        playerRef.current.currentTime = seekTo;
        lastSeekTo.current = seekTo;
        setCurrentTime(seekTo);
      } catch (error) {
        console.warn("Failed to seek:", error);
      }
    }
  }, [seekTo, isReady]);

  // Handle loop playback
  useEffect(() => {
    if (!isLooping || !loopRange || !playerRef.current || !isReady) return;

    const checkInterval = setInterval(() => {
      if (playerRef.current && isReady) {
        const current = playerRef.current.currentTime;

        // If we're beyond the end of the loop range, seek back to start
        if (current >= loopRange.end) {
          playerRef.current.currentTime = loopRange.start;
        }
      }
    }, 50); // Check every 50ms for responsive looping

    return () => clearInterval(checkInterval);
  }, [isLooping, loopRange, isReady]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopTimeUpdateLoop();
    };
  }, [stopTimeUpdateLoop]);

  // Handle player ready
  const handleReady = useCallback(() => {
    console.log("ReactPlayer ready");
    setIsReady(true);
    setIsLoading(false);
    setError(null);
    // Duration will be set via onDurationChange event when metadata loads
  }, []);

  // Handle play state changes
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    onPlayStateChange(true);
    startTimeUpdateLoop();
  }, [onPlayStateChange, startTimeUpdateLoop]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    onPlayStateChange(false);
    stopTimeUpdateLoop();
  }, [onPlayStateChange, stopTimeUpdateLoop]);

  // Handle duration change
  const handleDuration = useCallback(
    (event: any) => {
      // react-player v3 passes Event object, extract duration from target
      const target = event?.target as HTMLMediaElement;
      const duration = target?.duration;

      if (duration && !isNaN(duration) && duration > 0) {
        setDuration(duration);
        onDurationChange(duration);
      }
    },
    [onDurationChange],
  );

  // Handle player error
  const handleError = useCallback((error: any) => {
    console.error("ReactPlayer error:", error);
    setError("Failed to load video. Please check the YouTube URL.");
    setIsLoading(false);
  }, []);

  // Handle progress updates
  const handleProgress = useCallback(
    (state: {
      played: number;
      playedSeconds: number;
      loaded: number;
      loadedSeconds: number;
    }) => {
      // Only update if playedSeconds is a valid number
      if (typeof state.playedSeconds === 'number' && !isNaN(state.playedSeconds)) {
        setCurrentTime(state.playedSeconds);
        setBufferedTime(state.loadedSeconds);
        onTimeUpdate(state.playedSeconds);
      }
    },
    [onTimeUpdate],
  );

  // Handle play/pause toggle
  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Handle restart
  const handleRestart = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.currentTime = 0;
        setCurrentTime(0);
        onTimeUpdate(0);
      } catch (error) {
        console.warn("Failed to restart:", error);
      }
    }
  }, [onTimeUpdate]);

  // Handle playback speed change
  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  }, []);

  // Handle controls visibility
  const handleShowControls = useCallback(() => {
    setShowControls(true);

    // Clear existing timeout
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    // Hide controls after 3 seconds of inactivity (only when playing)
    if (isPlaying) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Show controls when paused, hide when playing
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      // Start hide timer when playing
      handleShowControls();
    }
  }, [isPlaying, handleShowControls]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  if (!isValidYouTubeUrl) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="aspect-video bg-gray-100 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="h-8 w-8 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">Invalid Video URL</h3>
            <p className="text-sm text-gray-600">
              Please enter a valid YouTube URL to continue.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="aspect-video bg-red-50 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-red-800 mb-2">
              Video Error
            </h3>
            <p className="text-sm text-red-600">{error}</p>
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
      </div>
    );
  }

  return (
    <>
      <div
        ref={videoContainerRef}
        className="relative w-full h-full cursor-pointer"
        onMouseMove={handleShowControls}
        onTouchStart={handleShowControls}
      >
        {/* ReactPlayer Container */}
        <div className="aspect-video bg-black relative w-full h-full">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-gray-600 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-white">Loading video...</p>
                <p className="text-gray-400 text-sm mt-2">
                  {videoUrl.length > 50
                    ? `${videoUrl.substring(0, 50)}...`
                    : videoUrl}
                </p>
              </div>
            </div>
          )}

          {/* ReactPlayer */}
          <ReactPlayer
            ref={playerRef}
            src={videoUrl}
            width="100%"
            height="100%"
            playing={isPlaying}
            volume={volume}
            muted={isMuted}
            playbackRate={playbackRate}
            controls={false}
            onReady={handleReady}
            onPlay={handlePlay}
            onPause={handlePause}
            onDurationChange={handleDuration}
            onTimeUpdate={handleProgress}
            onError={handleError}
            config={{
              youtube: {
                playerVars: {
                  showinfo: 0,
                  modestbranding: 1,
                  rel: 0,
                  enablejsapi: 1,
                  origin: window.location.origin,
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
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-10 transition-opacity duration-300 ${
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePlayPause}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
                  {isPlaying ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </button>

                <button
                  onClick={handleRestart}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>

                <div className="flex-1 text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>

                {/* Playback Speed Control */}
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="text-white hover:bg-white/20 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                    title="Playback speed"
                  >
                    {playbackRate}x
                  </button>

                  {showSpeedMenu && (
                    <div className="absolute bottom-full mb-2 right-0 bg-black/90 rounded-lg shadow-lg overflow-hidden backdrop-blur-sm">
                      {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => handlePlaybackRateChange(rate)}
                          className={`block w-full px-4 py-2 text-left text-white hover:bg-white/20 transition-colors text-sm ${
                            playbackRate === rate ? "bg-white/10" : ""
                          }`}
                        >
                          {rate}x {playbackRate === rate && "✓"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleMuteToggle}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
                  {isMuted ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Progress Bar */}
              {duration > 0 && (
                <div className="mt-3">
                  <div
                    className="w-full bg-white/30 rounded-full h-2 hover:h-3 relative cursor-pointer transition-all group"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const percentage = x / rect.width;
                      const seekTime = percentage * duration;
                      if (playerRef.current) {
                        playerRef.current.currentTime = seekTime;
                        setCurrentTime(seekTime);
                        onTimeUpdate(seekTime);
                      }
                    }}
                  >
                    {/* Buffered */}
                    <div
                      className="absolute top-0 left-0 h-full bg-white/50 rounded-full transition-all pointer-events-none z-0"
                      style={{ width: `${(bufferedTime / duration) * 100}%` }}
                    />
                    {/* Progress */}
                    <div
                      className="absolute top-0 left-0 h-full bg-red-600 rounded-full transition-all pointer-events-none z-10"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />

                    {/* Annotation markers */}
                    {annotations.map((annotation, index) => {
                      const startPos =
                        duration > 0
                          ? ((annotation.startTime || 0) / duration) * 100
                          : 0;
                      const endPos =
                        duration > 0
                          ? ((annotation.endTime || annotation.startTime || 0) /
                              duration) *
                            100
                          : 0;
                      const width = Math.max(endPos - startPos, 0.5);

                      return (
                        <div
                          key={annotation.id || index}
                          className="absolute top-0 h-full bg-yellow-400 rounded-full pointer-events-none opacity-70 group-hover:opacity-90 z-5"
                          style={{
                            left: `${startPos}%`,
                            width: `${width}%`,
                          }}
                          title={`${annotation.title || "Untitled"}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
