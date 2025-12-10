"use client";

import { useEffect, useRef } from "react";
import { useYDoc } from "@y-sweet/react";
import * as Y from "yjs";
import { nanoid } from "nanoid";
import {
  DEFAULT_PALETTE_COLORS,
  DEFAULT_GRID_COLUMNS,
  DEFAULT_GRID_ROWS,
  DEFAULT_CELL_SIZE,
  DEFAULT_DURATION,
  DEFAULT_FRAME_INTERVAL,
} from "../constants";
import { DRAWING_TOOLS } from "../types";

// Initialize the default paint state in the Y-Sweet document
export function usePaintInitialization() {
  const doc = useYDoc();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !doc) return;

    const rootMap = doc.getMap("paintState");

    // Check if already initialized
    if (rootMap.has("frames") && rootMap.has("palette")) {
      initialized.current = true;
      return;
    }

    const columns = DEFAULT_GRID_COLUMNS;
    const rows = DEFAULT_GRID_ROWS;

    doc.transact(() => {
      // Initialize simple values
      rootMap.set("cellSize", DEFAULT_CELL_SIZE);
      rootMap.set("duration", DEFAULT_DURATION);
      rootMap.set("drawingTool", DRAWING_TOOLS.PENCIL);

      // Initialize palette as Y.Map
      const paletteMap = new Y.Map();
      const paletteGrid = new Y.Array();

      DEFAULT_PALETTE_COLORS.forEach((color) => {
        const colorMap = new Y.Map();
        colorMap.set("color", color);
        colorMap.set("id", nanoid());
        paletteGrid.push([colorMap]);
      });

      paletteMap.set("grid", paletteGrid);
      paletteMap.set("position", 0);
      rootMap.set("palette", paletteMap);

      // Initialize frames as Y.Map
      const framesMap = new Y.Map();
      const framesList = new Y.Array();

      // Create first empty frame
      const firstFrame = new Y.Map();
      const grid = new Y.Array();
      grid.insert(0, Array(columns * rows).fill(""));
      firstFrame.set("grid", grid);
      firstFrame.set("interval", DEFAULT_FRAME_INTERVAL);
      firstFrame.set("key", nanoid());
      framesList.push([firstFrame]);

      framesMap.set("list", framesList);
      framesMap.set("columns", columns);
      framesMap.set("rows", rows);
      framesMap.set("activeIndex", 0);
      rootMap.set("frames", framesMap);
    });

    initialized.current = true;
  }, [doc]);

  return { initialized: initialized.current };
}
