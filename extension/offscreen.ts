// DJ Player Offscreen Document
// Hosts a muted YouTube player for reliable video end detection

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: typeof YT;
  }
}

declare namespace YT {
  class Player {
    constructor(elementId: string, options: PlayerOptions);
    loadVideoById(videoId: string, startSeconds?: number): void;
    cueVideoById(videoId: string, startSeconds?: number): void;
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead?: boolean): void;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
    setVolume(volume: number): void;
    getVolume(): number;
    setPlaybackRate(rate: number): void;
    getPlaybackRate(): number;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): PlayerState;
    destroy(): void;
  }

  interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    videoId?: string;
    playerVars?: PlayerVars;
    events?: PlayerEvents;
  }

  interface PlayerVars {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    mute?: 0 | 1;
    enablejsapi?: 0 | 1;
    origin?: string;
    rel?: 0 | 1;
    modestbranding?: 0 | 1;
    playsinline?: 0 | 1;
  }

  interface PlayerEvents {
    onReady?: (event: PlayerEvent) => void;
    onStateChange?: (event: OnStateChangeEvent) => void;
    onError?: (event: OnErrorEvent) => void;
  }

  interface PlayerEvent {
    target: Player;
  }

  interface OnStateChangeEvent {
    target: Player;
    data: PlayerState;
  }

  interface OnErrorEvent {
    target: Player;
    data: number;
  }

  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }
}

// Player instance
let player: YT.Player | null = null;
let isPlayerReady = false;
let currentVideoIndex = 0;

// Time update interval
let timeUpdateInterval: ReturnType<typeof setInterval> | null = null;
const TIME_UPDATE_INTERVAL_MS = 1000;

console.log("[Offscreen] DJ Player offscreen document loaded");

// Initialize YouTube player when API is ready
window.onYouTubeIframeAPIReady = () => {
  console.log("[Offscreen] YouTube IFrame API ready");

  player = new YT.Player("player", {
    height: "1",
    width: "1",
    playerVars: {
      autoplay: 0,
      controls: 0,
      mute: 1, // CRITICAL: Always muted - audio comes from ReactPlayer in web app
      enablejsapi: 1,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  });
};

function onPlayerReady(event: YT.PlayerEvent) {
  console.log("[Offscreen] Player ready");
  isPlayerReady = true;

  // Ensure player is muted
  event.target.mute();
  event.target.setVolume(0);

  // Notify service worker that player is ready
  chrome.runtime.sendMessage({
    action: "dj-player-ready",
  });
}

function onPlayerStateChange(event: YT.OnStateChangeEvent) {
  const stateNames: Record<number, string> = {
    [-1]: "UNSTARTED",
    [0]: "ENDED",
    [1]: "PLAYING",
    [2]: "PAUSED",
    [3]: "BUFFERING",
    [5]: "CUED",
  };

  const duration = player?.getDuration() || 0;
  const currentTime = player?.getCurrentTime() || 0;
  console.log(`[Offscreen] Player state changed: ${stateNames[event.data] || event.data} | index=${currentVideoIndex} time=${currentTime.toFixed(1)}s/${duration.toFixed(1)}s`);

  // Handle video ended - this is the critical event for auto-advance
  if (event.data === YT.PlayerState.ENDED) {
    console.log("[Offscreen] Video ended, notifying service worker");
    stopTimeUpdates();

    chrome.runtime.sendMessage({
      action: "dj-video-ended",
      video_index: currentVideoIndex,
    });
  }

  // Handle playing state
  if (event.data === YT.PlayerState.PLAYING) {
    startTimeUpdates();

    // Get duration now that video is playing
    const duration = player?.getDuration() || 0;
    chrome.runtime.sendMessage({
      action: "dj-state-changed",
      is_playing: true,
      duration,
    });
  }

  // Handle paused state
  if (event.data === YT.PlayerState.PAUSED) {
    stopTimeUpdates();

    chrome.runtime.sendMessage({
      action: "dj-state-changed",
      is_playing: false,
    });
  }
}

function onPlayerError(event: YT.OnErrorEvent) {
  console.error("[Offscreen] Player error:", event.data);

  const errorMessages: Record<number, string> = {
    2: "Invalid video ID",
    5: "HTML5 player error",
    100: "Video not found or private",
    101: "Embedding not allowed",
    150: "Embedding not allowed",
  };

  chrome.runtime.sendMessage({
    action: "dj-error",
    error: errorMessages[event.data] || `Unknown error: ${event.data}`,
    error_code: event.data,
  });
}

// Counter for periodic logging (every 5 updates = 5 seconds)
let timeUpdateLogCounter = 0;

function startTimeUpdates() {
  stopTimeUpdates();
  timeUpdateLogCounter = 0;

  console.log("[Offscreen] Starting time updates");

  timeUpdateInterval = setInterval(() => {
    if (player && isPlayerReady) {
      const currentTime = player.getCurrentTime();
      const duration = player.getDuration();

      // Log every 5 seconds to avoid spam
      timeUpdateLogCounter++;
      if (timeUpdateLogCounter % 5 === 0) {
        console.log(`[Offscreen] Time update: ${currentTime.toFixed(1)}s / ${duration.toFixed(1)}s (${((currentTime / duration) * 100).toFixed(0)}%)`);
      }

      chrome.runtime.sendMessage({
        action: "dj-time-update",
        current_time: currentTime,
        duration,
      });
    }
  }, TIME_UPDATE_INTERVAL_MS);
}

function stopTimeUpdates() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }
}

// Extract YouTube video ID from URL
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      console.log(`[Offscreen] Extracted video ID: ${match[1]} from URL: ${url}`);
      return match[1];
    }
  }

  console.warn(`[Offscreen] Could not extract video ID from: ${url}`);
  return null;
}

// Handle messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Offscreen] Received message:", message.action);

  if (!player || !isPlayerReady) {
    console.warn("[Offscreen] Player not ready yet");
    sendResponse({ success: false, error: "Player not ready" });
    return;
  }

  switch (message.action) {
    case "player-load": {
      const videoId = extractVideoId(message.url || message.video_id || "");
      if (!videoId) {
        console.error("[Offscreen] Invalid video URL/ID:", message.url || message.video_id);
        sendResponse({ success: false, error: "Invalid video URL" });
        return;
      }

      console.log("[Offscreen] Loading video:", videoId, "at", message.start_time || 0);
      currentVideoIndex = message.video_index ?? currentVideoIndex;

      // Ensure muted before loading
      player.mute();
      player.setVolume(0);

      player.loadVideoById(videoId, message.start_time || 0);
      sendResponse({ success: true });
      break;
    }

    case "player-play":
      console.log("[Offscreen] Playing");
      player.mute(); // Always ensure muted
      player.playVideo();
      sendResponse({ success: true });
      break;

    case "player-pause":
      console.log("[Offscreen] Pausing");
      player.pauseVideo();
      sendResponse({ success: true });
      break;

    case "player-seek":
      console.log("[Offscreen] Seeking to:", message.time);
      player.seekTo(message.time, true);
      sendResponse({ success: true });
      break;

    case "player-set-rate":
      console.log("[Offscreen] Setting rate:", message.rate);
      player.setPlaybackRate(message.rate);
      sendResponse({ success: true });
      break;

    case "player-get-state":
      sendResponse({
        success: true,
        is_playing: player.getPlayerState() === YT.PlayerState.PLAYING,
        current_time: player.getCurrentTime(),
        duration: player.getDuration(),
        playback_rate: player.getPlaybackRate(),
        video_index: currentVideoIndex,
      });
      break;

    case "player-stop":
      console.log("[Offscreen] Stopping");
      stopTimeUpdates();
      player.stopVideo();
      sendResponse({ success: true });
      break;

    default:
      console.log("[Offscreen] Unknown action:", message.action);
      sendResponse({ success: false, error: "Unknown action" });
  }

  return true; // Keep message channel open for async response
});

console.log("[Offscreen] Message listener registered");
