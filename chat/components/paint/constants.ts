// Default palette colors (30 colors from original pixel-art-react)
export const DEFAULT_PALETTE_COLORS = [
  "rgba(0, 0, 0, 1)",
  "rgba(255, 0, 0, 1)",
  "rgba(233, 30, 99, 1)",
  "rgba(156, 39, 176, 1)",
  "rgba(103, 58, 183, 1)",
  "rgba(63, 81, 181, 1)",
  "rgba(33, 150, 243, 1)",
  "rgba(3, 169, 244, 1)",
  "rgba(0, 188, 212, 1)",
  "rgba(0, 150, 136, 1)",
  "rgba(76, 175, 80, 1)",
  "rgba(139, 195, 74, 1)",
  "rgba(205, 220, 57, 1)",
  "rgba(158, 224, 122, 1)",
  "rgba(255, 235, 59, 1)",
  "rgba(255, 193, 7, 1)",
  "rgba(255, 152, 0, 1)",
  "rgba(255, 205, 210, 1)",
  "rgba(255, 87, 34, 1)",
  "rgba(121, 85, 72, 1)",
  "rgba(158, 158, 158, 1)",
  "rgba(96, 125, 139, 1)",
  "rgba(48, 63, 70, 1)",
  "rgba(255, 255, 255, 1)",
  "rgba(56, 53, 53, 1)",
  "rgba(56, 53, 53, 1)",
  "rgba(56, 53, 53, 1)",
  "rgba(56, 53, 53, 1)",
  "rgba(56, 53, 53, 1)",
  "rgba(56, 53, 53, 1)",
];

// Default grid dimensions
export const DEFAULT_GRID_COLUMNS = 20;
export const DEFAULT_GRID_ROWS = 20;

// Default cell size in pixels
export const DEFAULT_CELL_SIZE = 10;

// Default animation duration in seconds
export const DEFAULT_DURATION = 1;

// Default frame interval in milliseconds
export const DEFAULT_FRAME_INTERVAL = 100;

// Grid background color for empty cells
export const GRID_BACKGROUND_COLOR = "rgb(49, 49, 49)";

// Minimum and maximum values
export const MIN_GRID_SIZE = 1;
export const MAX_GRID_SIZE = 100;
export const MIN_CELL_SIZE = 1;
export const MAX_CELL_SIZE = 50;
export const MIN_DURATION = 0.1;
export const MAX_DURATION = 10;

// Calculate time interval for a frame based on its position
export function getTimeInterval(frameIndex: number, totalFrames: number): number {
  if (totalFrames <= 1) return DEFAULT_FRAME_INTERVAL;
  return Math.round((100 / totalFrames) * 10);
}

// Zoom settings
export const MIN_ZOOM_LEVEL = 0.25;
export const MAX_ZOOM_LEVEL = 4.0;
export const DEFAULT_ZOOM_LEVEL = 1.0;
export const ZOOM_STEP = 0.1;
export const WHEEL_ZOOM_FACTOR = 0.001;
