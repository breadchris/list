// Drawing tool types
export type DrawingTool = "PENCIL" | "ERASER" | "BUCKET" | "MOVE" | "EYEDROPPER";

export const DRAWING_TOOLS = {
  PENCIL: "PENCIL" as const,
  ERASER: "ERASER" as const,
  BUCKET: "BUCKET" as const,
  MOVE: "MOVE" as const,
  EYEDROPPER: "EYEDROPPER" as const,
};

// Palette color
export interface PaletteColor {
  id: string;
  color: string;
}

// Animation frame
export interface Frame {
  key: string;
  grid: string[]; // Array of color strings, empty string = transparent
  interval: number; // Duration in milliseconds
}

// Full paint state structure
export interface PaintState {
  cell_size: number;
  duration: number;
  drawing_tool: DrawingTool;
  palette: {
    grid: PaletteColor[];
    position: number;
  };
  frames: {
    list: Frame[];
    columns: number;
    rows: number;
    active_index: number;
  };
}

// Canvas state for rendering
export interface CanvasState {
  grid: string[];
  columns: number;
  rows: number;
  drawing_tool: DrawingTool;
  palette_color: string | null;
  cell_size: number;
}

// Cell action parameters
export interface CellActionParams {
  id: number;
  drawing_tool: DrawingTool;
  color: string;
  palette_color: string | null;
  columns: number;
  rows: number;
}

// Move drawing parameters
export interface MoveDrawingParams {
  x_diff: number;
  y_diff: number;
  cell_width: number;
}

// Dimension change parameters
export interface DimensionChangeParams {
  grid_property: "columns" | "rows";
  increment: number;
}

// Reorder frame parameters
export interface ReorderFrameParams {
  selected_index: number;
  destination_index: number;
}

// Export data for save/load
export interface ExportData {
  frames: Array<{
    grid: string[];
    interval: number;
    key: string;
  }>;
  palette_grid_data: PaletteColor[];
  cell_size: number;
  columns: number;
  rows: number;
  animate: boolean;
}

// CSS generation data
export interface CssGenerationData {
  grid: string[];
  columns: number;
  rows: number;
  cell_size: number;
  duration: number;
  active_frame_index: number;
  frames: Frame[];
}
