// Default playback settings
export const DEFAULT_VOLUME = 0.8;
export const DEFAULT_PLAYBACK_RATE = 1.0;

// Available playback rates
export const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// Controls auto-hide delay in milliseconds
export const CONTROLS_HIDE_DELAY = 3000;

// Time update polling interval in milliseconds
export const TIME_UPDATE_INTERVAL = 100;

// Sync threshold - if playback times differ by more than this, sync
export const SYNC_THRESHOLD_SECONDS = 2;

// Debounce delay for time updates to avoid flooding Yjs
export const TIME_SYNC_DEBOUNCE_MS = 500;
