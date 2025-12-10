"use client";

import { useMemo, useSyncExternalStore, useCallback, useRef } from "react";
import { useYDoc } from "@y-sweet/react";
import * as Y from "yjs";
import type {
  DrawingTool,
  PaletteColor,
  Frame,
  PaintState,
  CanvasState,
  ExportData,
  CssGenerationData,
} from "../types";
import { DRAWING_TOOLS } from "../types";
import {
  DEFAULT_CELL_SIZE,
  DEFAULT_DURATION,
  DEFAULT_GRID_COLUMNS,
  DEFAULT_GRID_ROWS,
} from "../constants";

// Helper to safely get nested Y.Map values
function getMapValue<T>(map: Y.Map<unknown> | undefined, key: string, defaultValue: T): T {
  if (!map) return defaultValue;
  const value = map.get(key);
  return value !== undefined ? (value as T) : defaultValue;
}

// Hook to subscribe to Y.js document changes
// Uses cached snapshot to avoid infinite loop with useSyncExternalStore
function useYjsSubscription(doc: Y.Doc | null) {
  const snapshotRef = useRef<unknown>(null);
  const snapshotJsonRef = useRef<string>("");

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!doc) return () => {};
      const rootMap = doc.getMap("paintState");

      const handler = () => {
        // Update cached snapshot when Yjs changes
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

// Main paint state hook
export function usePaintState() {
  const doc = useYDoc();
  const snapshot = useYjsSubscription(doc);

  const state = useMemo((): PaintState => {
    if (!doc || !snapshot) {
      return getDefaultState();
    }

    const rootMap = doc.getMap("paintState");
    const framesMap = rootMap.get("frames") as Y.Map<unknown> | undefined;
    const paletteMap = rootMap.get("palette") as Y.Map<unknown> | undefined;

    // Extract palette
    const paletteGrid: PaletteColor[] = [];
    const paletteGridYArray = paletteMap?.get("grid") as Y.Array<Y.Map<unknown>> | undefined;
    if (paletteGridYArray) {
      paletteGridYArray.forEach((colorMap) => {
        paletteGrid.push({
          id: colorMap.get("id") as string,
          color: colorMap.get("color") as string,
        });
      });
    }

    // Extract frames
    const framesList: Frame[] = [];
    const framesListYArray = framesMap?.get("list") as Y.Array<Y.Map<unknown>> | undefined;
    if (framesListYArray) {
      framesListYArray.forEach((frameMap) => {
        const gridYArray = frameMap.get("grid") as Y.Array<string>;
        framesList.push({
          key: frameMap.get("key") as string,
          grid: gridYArray ? gridYArray.toArray() : [],
          interval: (frameMap.get("interval") as number) || 100,
        });
      });
    }

    return {
      cell_size: getMapValue(rootMap, "cellSize", DEFAULT_CELL_SIZE),
      duration: getMapValue(rootMap, "duration", DEFAULT_DURATION),
      drawing_tool: getMapValue(rootMap, "drawingTool", DRAWING_TOOLS.PENCIL) as DrawingTool,
      palette: {
        grid: paletteGrid,
        position: getMapValue(paletteMap, "position", 0),
      },
      frames: {
        list: framesList,
        columns: getMapValue(framesMap, "columns", DEFAULT_GRID_COLUMNS),
        rows: getMapValue(framesMap, "rows", DEFAULT_GRID_ROWS),
        active_index: getMapValue(framesMap, "activeIndex", 0),
      },
    };
  }, [doc, snapshot]);

  return { state, doc };
}

// Hook for cell size
export function useCellSize(): number {
  const { state } = usePaintState();
  return state.cell_size;
}

// Hook for duration
export function useDuration(): number {
  const { state } = usePaintState();
  return state.duration;
}

// Hook for drawing tool
export function useDrawingTool(): DrawingTool {
  const { state } = usePaintState();
  return state.drawing_tool;
}

// Hook for palette
export function usePalette() {
  const { state } = usePaintState();
  return state.palette;
}

// Hook for selected palette color
export function useSelectedPaletteColor(): string | null {
  const palette = usePalette();
  const { position, grid } = palette;
  if (position < 0 || position >= grid.length) {
    return null;
  }
  return grid[position]?.color || null;
}

// Hook for frames state
export function useFrames() {
  const { state } = usePaintState();
  return state.frames;
}

// Hook for active frame
export function useActiveFrame(): Frame | null {
  const frames = useFrames();
  const activeIndex = frames.active_index;
  return frames.list[activeIndex] || null;
}

// Hook for active frame grid
export function useActiveFrameGrid(): string[] {
  const activeFrame = useActiveFrame();
  return activeFrame?.grid || [];
}

// Hook for grid dimensions
export function useGridDimensions() {
  const frames = useFrames();
  return {
    columns: frames.columns,
    rows: frames.rows,
  };
}

// Hook for frame count
export function useFrameCount(): number {
  const frames = useFrames();
  return frames.list.length;
}

// Hook for active frame index
export function useActiveFrameIndex(): number {
  const frames = useFrames();
  return frames.active_index;
}

// Hook to check if a specific tool is active
export function useIsToolActive(toolName: DrawingTool): boolean {
  const drawingTool = useDrawingTool();
  return drawingTool === toolName;
}

// Hook for canvas props (commonly used together)
export function useCanvasState(): CanvasState {
  const { state } = usePaintState();
  const { frames, palette } = state;
  const activeIndex = frames.active_index;
  const activeFrame = frames.list[activeIndex];

  const palettePosition = palette.position;
  const paletteColor =
    palettePosition >= 0 && palette.grid[palettePosition]
      ? palette.grid[palettePosition].color
      : null;

  return {
    grid: activeFrame?.grid || [],
    columns: frames.columns,
    rows: frames.rows,
    drawing_tool: state.drawing_tool,
    palette_color: paletteColor,
    cell_size: state.cell_size,
  };
}

// Hook for export data
export function useExportData(): ExportData {
  const { state } = usePaintState();
  const { frames, palette } = state;

  return {
    frames: frames.list.map((frame) => ({
      grid: frame.grid,
      interval: frame.interval,
      key: frame.key,
    })),
    palette_grid_data: palette.grid,
    cell_size: state.cell_size,
    columns: frames.columns,
    rows: frames.rows,
    animate: frames.list.length > 1,
  };
}

// Hook for CSS generation data
export function useCssGenerationData(): CssGenerationData {
  const { state } = usePaintState();
  const { frames } = state;
  const activeIndex = frames.active_index;
  const activeFrame = frames.list[activeIndex];

  return {
    grid: activeFrame?.grid || [],
    columns: frames.columns,
    rows: frames.rows,
    cell_size: state.cell_size,
    duration: state.duration,
    active_frame_index: activeIndex,
    frames: frames.list,
  };
}

// Hook for frame list
export function useFrameList(): Frame[] {
  const frames = useFrames();
  return frames.list;
}

// Hook for frames handler state
export function useFramesHandlerState() {
  const { state } = usePaintState();
  const { frames } = state;

  return {
    frames: frames.list,
    active_index: frames.active_index,
    columns: frames.columns,
    rows: frames.rows,
  };
}

// Hook for preview data
export function usePreviewData() {
  const { state } = usePaintState();
  const { frames, palette } = state;

  return {
    frames: frames.list,
    active_frame_index: frames.active_index,
    active_frame: frames.list[frames.active_index] || null,
    palette_grid_data: palette.grid,
    columns: frames.columns,
    rows: frames.rows,
    cell_size: state.cell_size,
    duration: state.duration,
  };
}

// Default state factory
function getDefaultState(): PaintState {
  return {
    cell_size: DEFAULT_CELL_SIZE,
    duration: DEFAULT_DURATION,
    drawing_tool: DRAWING_TOOLS.PENCIL,
    palette: {
      grid: [],
      position: 0,
    },
    frames: {
      list: [],
      columns: DEFAULT_GRID_COLUMNS,
      rows: DEFAULT_GRID_ROWS,
      active_index: 0,
    },
  };
}
