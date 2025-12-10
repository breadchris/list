"use client";

import React, { useMemo } from "react";
import type { Frame as FrameType } from "../types";
import { generateInlineBoxShadow } from "../utils/css-generator";

interface FrameProps {
  frame: FrameType;
  index: number;
  columns: number;
  rows: number;
  isActive: boolean;
  onClick: () => void;
}

// Preview cell size for frame thumbnails
const PREVIEW_CELL_SIZE = 2;

export function Frame({
  frame,
  columns,
  rows,
  isActive,
  onClick,
}: FrameProps) {
  const previewWidth = columns * PREVIEW_CELL_SIZE;
  const previewHeight = rows * PREVIEW_CELL_SIZE;

  // Generate box-shadow for preview
  const boxShadow = useMemo(() => {
    return generateInlineBoxShadow(frame.grid, columns, PREVIEW_CELL_SIZE);
  }, [frame.grid, columns]);

  return (
    <button
      onClick={onClick}
      className={`relative rounded-lg p-1.5 transition-all ${
        isActive
          ? "bg-rose-500/20 ring-2 ring-rose-500"
          : "bg-neutral-800 hover:bg-neutral-700"
      }`}
      style={{
        width: previewWidth + 12,
        height: previewHeight + 12,
      }}
    >
      {/* Frame preview using box-shadow technique */}
      <div
        className="relative"
        style={{
          width: previewWidth,
          height: previewHeight,
        }}
      >
        {/* Background grid */}
        <div
          className="absolute inset-0 bg-neutral-700"
          style={{
            width: previewWidth,
            height: previewHeight,
          }}
        />
        {/* Pixel art using box-shadow */}
        {boxShadow && (
          <div
            style={{
              width: PREVIEW_CELL_SIZE,
              height: PREVIEW_CELL_SIZE,
              boxShadow,
              position: "absolute",
              top: 0,
              left: 0,
            }}
          />
        )}
      </div>
    </button>
  );
}
