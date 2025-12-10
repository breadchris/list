"use client";

import React, { memo } from "react";

interface PixelCellProps {
  id: number;
  color: string;
  size: number;
  onMouseDown: () => void;
  onMouseEnter: () => void;
  onTouchStart: () => void;
}

export const PixelCell = memo(function PixelCell({
  id,
  color,
  size,
  onMouseDown,
  onMouseEnter,
  onTouchStart,
}: PixelCellProps) {
  // Default grid color for empty cells
  const backgroundColor = color || "rgb(49, 49, 49)";

  return (
    <div
      className="box-border"
      data-cell-id={id}
      style={{
        width: size,
        height: size,
        backgroundColor,
        borderRight: "1px solid rgba(100, 100, 100, 0.3)",
        borderBottom: "1px solid rgba(100, 100, 100, 0.3)",
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onTouchStart={onTouchStart}
    />
  );
});
