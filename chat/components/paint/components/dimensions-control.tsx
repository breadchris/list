"use client";

import React from "react";
import { Plus, Minus } from "lucide-react";
import { useGridDimensions, useCellSize } from "../hooks/use-paint-state";
import { usePaintActions } from "../hooks/use-paint-actions";
import {
  MIN_GRID_SIZE,
  MAX_GRID_SIZE,
  MIN_CELL_SIZE,
  MAX_CELL_SIZE,
} from "../constants";

export function DimensionsControl() {
  const { columns, rows } = useGridDimensions();
  const cellSize = useCellSize();
  const { changeDimensions, setCellSize } = usePaintActions();

  const handleColumnsChange = (increment: number) => {
    const newValue = columns + increment;
    if (newValue >= MIN_GRID_SIZE && newValue <= MAX_GRID_SIZE) {
      changeDimensions({ grid_property: "columns", increment });
    }
  };

  const handleRowsChange = (increment: number) => {
    const newValue = rows + increment;
    if (newValue >= MIN_GRID_SIZE && newValue <= MAX_GRID_SIZE) {
      changeDimensions({ grid_property: "rows", increment });
    }
  };

  const handleCellSizeChange = (value: number) => {
    if (value >= MIN_CELL_SIZE && value <= MAX_CELL_SIZE) {
      setCellSize(value);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
        Dimensions
      </div>

      {/* Width (columns) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400">Width</span>
          <span className="text-xs text-neutral-500">{columns}px</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleColumnsChange(-1)}
            disabled={columns <= MIN_GRID_SIZE}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-neutral-400"
          >
            <Minus className="w-3 h-3" />
          </button>
          <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 transition-all"
              style={{ width: `${(columns / MAX_GRID_SIZE) * 100}%` }}
            />
          </div>
          <button
            onClick={() => handleColumnsChange(1)}
            disabled={columns >= MAX_GRID_SIZE}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-neutral-400"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Height (rows) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400">Height</span>
          <span className="text-xs text-neutral-500">{rows}px</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleRowsChange(-1)}
            disabled={rows <= MIN_GRID_SIZE}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-neutral-400"
          >
            <Minus className="w-3 h-3" />
          </button>
          <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 transition-all"
              style={{ width: `${(rows / MAX_GRID_SIZE) * 100}%` }}
            />
          </div>
          <button
            onClick={() => handleRowsChange(1)}
            disabled={rows >= MAX_GRID_SIZE}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-neutral-400"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Pixel size */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400">Pixel Size</span>
          <span className="text-xs text-neutral-500">{cellSize}px</span>
        </div>
        <input
          type="range"
          min={MIN_CELL_SIZE}
          max={MAX_CELL_SIZE}
          value={cellSize}
          onChange={(e) => handleCellSizeChange(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
}
