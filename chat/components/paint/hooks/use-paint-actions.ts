"use client";

import { useCallback } from "react";
import { useYDoc } from "@y-sweet/react";
import * as Y from "yjs";
import { nanoid } from "nanoid";
import type {
  DrawingTool,
  CellActionParams,
  MoveDrawingParams,
  DimensionChangeParams,
  ReorderFrameParams,
} from "../types";
import { DRAWING_TOOLS } from "../types";
import { GRID_BACKGROUND_COLOR, getTimeInterval } from "../constants";
import {
  applyBucketFill,
  shiftPixelsUp,
  shiftPixelsDown,
  shiftPixelsLeft,
  shiftPixelsRight,
} from "../utils/bucket-fill";

// Helper to get the active frame grid
function getActiveFrameGrid(rootMap: Y.Map<unknown>): Y.Array<string> | null {
  const framesMap = rootMap.get("frames") as Y.Map<unknown> | undefined;
  if (!framesMap) return null;
  const activeIndex = (framesMap.get("activeIndex") as number) || 0;
  const framesList = framesMap.get("list") as Y.Array<Y.Map<unknown>> | undefined;
  if (!framesList) return null;
  const activeFrame = framesList.get(activeIndex);
  if (!activeFrame) return null;
  return activeFrame.get("grid") as Y.Array<string>;
}

// Reset intervals for all frames
function resetFrameIntervals(framesList: Y.Array<Y.Map<unknown>>) {
  const count = framesList.length;
  for (let i = 0; i < count; i++) {
    const frame = framesList.get(i);
    frame.set("interval", getTimeInterval(i, count));
  }
}

// Parse color object to string
function parseColorToString(
  colorData: string | { r: number; g: number; b: number; a: number }
): string {
  if (typeof colorData === "string") return colorData;
  return `rgba(${colorData.r},${colorData.g},${colorData.b},${colorData.a})`;
}

// Main actions hook
export function usePaintActions() {
  const doc = useYDoc();

  // Cell action (drawing)
  const cellAction = useCallback(
    ({ id, drawing_tool, color, palette_color, columns, rows }: CellActionParams) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");
      const grid = getActiveFrameGrid(rootMap);
      if (!grid) return;

      doc.transact(() => {
        switch (drawing_tool) {
          case DRAWING_TOOLS.PENCIL:
            grid.delete(id, 1);
            grid.insert(id, [palette_color || ""]);
            break;

          case DRAWING_TOOLS.ERASER:
            grid.delete(id, 1);
            grid.insert(id, [""]);
            break;

          case DRAWING_TOOLS.BUCKET: {
            const gridArray = grid.toArray();
            const changes = applyBucketFill(
              gridArray,
              id,
              palette_color || "",
              columns,
              rows
            );
            // Apply changes in reverse order to avoid index shifts
            changes.sort((a, b) => b.id - a.id);
            for (const change of changes) {
              grid.delete(change.id, 1);
              grid.insert(change.id, [change.color]);
            }
            break;
          }

          case DRAWING_TOOLS.EYEDROPPER: {
            const cellColor = color || GRID_BACKGROUND_COLOR;
            const paletteMap = rootMap.get("palette") as Y.Map<unknown>;
            if (!paletteMap) return;

            const paletteGrid = paletteMap.get("grid") as Y.Array<Y.Map<unknown>>;
            if (!paletteGrid) return;

            // Check if color exists in palette
            let foundIndex = -1;
            for (let i = 0; i < paletteGrid.length; i++) {
              const item = paletteGrid.get(i);
              if (item.get("color") === cellColor) {
                foundIndex = i;
                break;
              }
            }

            if (foundIndex !== -1) {
              paletteMap.set("position", foundIndex);
            } else {
              // Add to last slot
              const lastIndex = paletteGrid.length - 1;
              const lastItem = paletteGrid.get(lastIndex);
              if (lastItem) {
                lastItem.set("color", cellColor);
              }
              paletteMap.set("position", lastIndex);
            }

            // Switch back to pencil after eyedropper
            rootMap.set("drawingTool", DRAWING_TOOLS.PENCIL);
            break;
          }

          default:
            break;
        }
      });
    },
    [doc]
  );

  // Move drawing
  const moveDrawing = useCallback(
    ({ x_diff, y_diff, cell_width }: MoveDrawingParams) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");
      const grid = getActiveFrameGrid(rootMap);
      if (!grid) return;

      const framesMap = rootMap.get("frames") as Y.Map<unknown>;
      const columns = (framesMap?.get("columns") as number) || 20;

      const x = x_diff / cell_width;
      const y = y_diff / cell_width;

      doc.transact(() => {
        const gridArray = grid.toArray();
        let newGrid = gridArray;

        if (Math.abs(x) > 1) {
          if (x < 0) {
            newGrid = shiftPixelsLeft(newGrid, columns);
          } else {
            newGrid = shiftPixelsRight(newGrid, columns);
          }
        }
        if (Math.abs(y) > 1) {
          if (y < 0) {
            newGrid = shiftPixelsUp(newGrid, columns);
          } else {
            newGrid = shiftPixelsDown(newGrid, columns);
          }
        }

        if (newGrid !== gridArray) {
          grid.delete(0, grid.length);
          grid.insert(0, newGrid);
        }
      });
    },
    [doc]
  );

  // Switch tool
  const switchTool = useCallback(
    (tool: DrawingTool) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");
      const currentTool = rootMap.get("drawingTool") as DrawingTool;

      doc.transact(() => {
        if (currentTool === tool) {
          rootMap.set("drawingTool", DRAWING_TOOLS.PENCIL);
        } else {
          rootMap.set("drawingTool", tool);
        }

        // Deselect palette for eraser and move
        if (tool === DRAWING_TOOLS.ERASER || tool === DRAWING_TOOLS.MOVE) {
          const paletteMap = rootMap.get("palette") as Y.Map<unknown>;
          if (paletteMap) {
            paletteMap.set("position", -1);
          }
        }
      });
    },
    [doc]
  );

  // Select palette color
  const selectPaletteColor = useCallback(
    (position: number) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");

      doc.transact(() => {
        const paletteMap = rootMap.get("palette") as Y.Map<unknown>;
        if (paletteMap) {
          paletteMap.set("position", position);
        }

        // Disable eyedropper/eraser/move when selecting a color
        const currentTool = rootMap.get("drawingTool") as DrawingTool;
        if (
          currentTool === DRAWING_TOOLS.EYEDROPPER ||
          currentTool === DRAWING_TOOLS.ERASER ||
          currentTool === DRAWING_TOOLS.MOVE
        ) {
          rootMap.set("drawingTool", DRAWING_TOOLS.PENCIL);
        }
      });
    },
    [doc]
  );

  // Set custom color
  const setCustomColor = useCallback(
    (customColor: string | { r: number; g: number; b: number; a: number }) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");

      doc.transact(() => {
        const paletteMap = rootMap.get("palette") as Y.Map<unknown>;
        if (!paletteMap) return;

        const colorString = parseColorToString(customColor);
        const position = paletteMap.get("position") as number;
        const paletteGrid = paletteMap.get("grid") as Y.Array<Y.Map<unknown>>;

        if (position < 0 || !paletteGrid) {
          // Add to last cell if no selection
          const lastIndex = paletteGrid.length - 1;
          const lastItem = paletteGrid.get(lastIndex);
          if (lastItem) {
            lastItem.set("color", colorString);
          }
          paletteMap.set("position", lastIndex);
        } else {
          // Update selected color
          const item = paletteGrid.get(position);
          if (item) {
            item.set("color", colorString);
          }
        }
      });
    },
    [doc]
  );

  // Set cell size
  const setCellSize = useCallback(
    (cellSize: number) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");
      rootMap.set("cellSize", cellSize);
    },
    [doc]
  );

  // Set duration
  const setDuration = useCallback(
    (duration: number) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");
      rootMap.set("duration", duration);
    },
    [doc]
  );

  // Change dimensions
  const changeDimensions = useCallback(
    ({ grid_property, increment }: DimensionChangeParams) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");
      const framesMap = rootMap.get("frames") as Y.Map<unknown>;
      if (!framesMap) return;

      const columns = framesMap.get("columns") as number;
      const rows = framesMap.get("rows") as number;
      const framesList = framesMap.get("list") as Y.Array<Y.Map<unknown>>;

      doc.transact(() => {
        if (grid_property === "columns") {
          const newColumns = columns + increment;
          if (newColumns < 1) return;

          for (let i = 0; i < framesList.length; i++) {
            const frame = framesList.get(i);
            const grid = frame.get("grid") as Y.Array<string>;
            const gridArray = grid.toArray();
            const newGrid: string[] = [];

            if (increment > 0) {
              // Add column
              for (let row = 0; row < rows; row++) {
                const start = row * columns;
                newGrid.push(...gridArray.slice(start, start + columns), "");
              }
            } else {
              // Remove column
              for (let row = 0; row < rows; row++) {
                const start = row * columns;
                newGrid.push(...gridArray.slice(start, start + columns - 1));
              }
            }

            grid.delete(0, grid.length);
            grid.insert(0, newGrid);
          }

          framesMap.set("columns", newColumns);
        } else if (grid_property === "rows") {
          const newRows = rows + increment;
          if (newRows < 1) return;

          for (let i = 0; i < framesList.length; i++) {
            const frame = framesList.get(i);
            const grid = frame.get("grid") as Y.Array<string>;

            if (increment > 0) {
              // Add row at end
              grid.insert(grid.length, Array(columns).fill(""));
            } else {
              // Remove last row
              grid.delete(grid.length - columns, columns);
            }
          }

          framesMap.set("rows", newRows);
        }
      });
    },
    [doc]
  );

  // Reset grid
  const resetGrid = useCallback(() => {
    if (!doc) return;
    const rootMap = doc.getMap("paintState");
    const grid = getActiveFrameGrid(rootMap);
    if (!grid) return;

    doc.transact(() => {
      const length = grid.length;
      grid.delete(0, length);
      grid.insert(0, Array(length).fill(""));
    });
  }, [doc]);

  // Create new frame
  const createNewFrame = useCallback(() => {
    if (!doc) return;
    const rootMap = doc.getMap("paintState");
    const framesMap = rootMap.get("frames") as Y.Map<unknown>;
    if (!framesMap) return;

    const framesList = framesMap.get("list") as Y.Array<Y.Map<unknown>>;
    const columns = framesMap.get("columns") as number;
    const rows = framesMap.get("rows") as number;

    doc.transact(() => {
      const newFrame = new Y.Map();
      const grid = new Y.Array<string>();
      grid.insert(0, Array(columns * rows).fill(""));
      newFrame.set("grid", grid);
      newFrame.set("interval", 100);
      newFrame.set("key", nanoid());
      framesList.push([newFrame]);

      resetFrameIntervals(framesList);
      framesMap.set("activeIndex", framesList.length - 1);
    });
  }, [doc]);

  // Delete frame
  const deleteFrame = useCallback(
    (frameIndex: number) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");
      const framesMap = rootMap.get("frames") as Y.Map<unknown>;
      if (!framesMap) return;

      const framesList = framesMap.get("list") as Y.Array<Y.Map<unknown>>;
      if (framesList.length <= 1) return; // Don't delete last frame

      const activeIndex = framesMap.get("activeIndex") as number;

      doc.transact(() => {
        framesList.delete(frameIndex, 1);
        resetFrameIntervals(framesList);

        // Adjust active index if needed
        if (activeIndex >= frameIndex && activeIndex > 0) {
          framesMap.set("activeIndex", activeIndex - 1);
        } else if (activeIndex >= framesList.length) {
          framesMap.set("activeIndex", framesList.length - 1);
        }
      });
    },
    [doc]
  );

  // Duplicate frame
  const duplicateFrame = useCallback(
    (frameIndex: number) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");
      const framesMap = rootMap.get("frames") as Y.Map<unknown>;
      if (!framesMap) return;

      const framesList = framesMap.get("list") as Y.Array<Y.Map<unknown>>;
      const sourceFrame = framesList.get(frameIndex);
      if (!sourceFrame) return;

      doc.transact(() => {
        const newFrame = new Y.Map();
        const newGrid = new Y.Array<string>();
        const sourceGrid = sourceFrame.get("grid") as Y.Array<string>;
        newGrid.insert(0, sourceGrid.toArray());
        newFrame.set("grid", newGrid);
        newFrame.set("interval", sourceFrame.get("interval"));
        newFrame.set("key", nanoid());

        // Insert after source frame
        framesList.insert(frameIndex + 1, [newFrame]);
        resetFrameIntervals(framesList);
        framesMap.set("activeIndex", frameIndex + 1);
      });
    },
    [doc]
  );

  // Change active frame
  const changeActiveFrame = useCallback(
    (frameIndex: number) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");
      const framesMap = rootMap.get("frames") as Y.Map<unknown>;
      if (framesMap) {
        framesMap.set("activeIndex", frameIndex);
      }
    },
    [doc]
  );

  // Reorder frame
  const reorderFrame = useCallback(
    ({ selected_index, destination_index }: ReorderFrameParams) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");
      const framesMap = rootMap.get("frames") as Y.Map<unknown>;
      if (!framesMap) return;

      const framesList = framesMap.get("list") as Y.Array<Y.Map<unknown>>;
      if (selected_index === destination_index) return;

      doc.transact(() => {
        const sourceFrame = framesList.get(selected_index);

        // Create a copy of the frame
        const newFrame = new Y.Map();
        const newGrid = new Y.Array<string>();
        const sourceGrid = sourceFrame.get("grid") as Y.Array<string>;
        newGrid.insert(0, sourceGrid.toArray());
        newFrame.set("grid", newGrid);
        newFrame.set("interval", sourceFrame.get("interval"));
        newFrame.set("key", nanoid());

        // Remove from old position and insert at new position
        if (selected_index < destination_index) {
          framesList.insert(destination_index + 1, [newFrame]);
          framesList.delete(selected_index, 1);
        } else {
          framesList.delete(selected_index, 1);
          framesList.insert(destination_index, [newFrame]);
        }

        resetFrameIntervals(framesList);
        framesMap.set("activeIndex", destination_index);
      });
    },
    [doc]
  );

  // Change frame interval
  const changeFrameInterval = useCallback(
    (frameIndex: number, interval: number) => {
      if (!doc) return;
      const rootMap = doc.getMap("paintState");
      const framesMap = rootMap.get("frames") as Y.Map<unknown>;
      if (!framesMap) return;

      const framesList = framesMap.get("list") as Y.Array<Y.Map<unknown>>;
      const frame = framesList.get(frameIndex);
      if (frame) {
        frame.set("interval", interval);
      }
    },
    [doc]
  );

  return {
    // Drawing
    cellAction,
    moveDrawing,
    resetGrid,

    // Tool
    switchTool,

    // Palette
    selectPaletteColor,
    setCustomColor,

    // Settings
    setCellSize,
    setDuration,
    changeDimensions,

    // Frames
    createNewFrame,
    deleteFrame,
    duplicateFrame,
    changeActiveFrame,
    reorderFrame,
    changeFrameInterval,
  };
}

// Export individual action hooks for more granular usage
export function useDrawingActions() {
  const { cellAction, moveDrawing, resetGrid } = usePaintActions();
  return { cellAction, moveDrawing, resetGrid };
}

export function useToolActions() {
  const { switchTool } = usePaintActions();
  return { switchTool };
}

export function usePaletteActions() {
  const { selectPaletteColor, setCustomColor } = usePaintActions();
  return { selectPaletteColor, setCustomColor };
}

export function useFrameActions() {
  const {
    createNewFrame,
    deleteFrame,
    duplicateFrame,
    changeActiveFrame,
    reorderFrame,
    changeFrameInterval,
  } = usePaintActions();
  return {
    createNewFrame,
    deleteFrame,
    duplicateFrame,
    changeActiveFrame,
    reorderFrame,
    changeFrameInterval,
  };
}

export function useSettingsActions() {
  const { setCellSize, setDuration, changeDimensions } = usePaintActions();
  return { setCellSize, setDuration, changeDimensions };
}
