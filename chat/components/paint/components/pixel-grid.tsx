"use client";

import React from "react";
import { PixelCell } from "./pixel-cell";

interface PixelGridProps {
  grid: string[];
  columns: number;
  rows: number;
  cellSize: number;
  onCellAction: (id: number) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
}

export function PixelGrid({
  grid,
  columns,
  rows,
  cellSize,
  onCellAction,
  isDragging,
  setIsDragging,
}: PixelGridProps) {
  const gridWidth = columns * cellSize;
  const gridHeight = rows * cellSize;

  const handleCellMouseDown = (id: number) => {
    setIsDragging(true);
    onCellAction(id);
  };

  const handleCellMouseEnter = (id: number) => {
    if (isDragging) {
      onCellAction(id);
    }
  };

  const handleCellTouchStart = (id: number) => {
    setIsDragging(true);
    onCellAction(id);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault(); // Prevent scrolling while drawing

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const cellId = element?.getAttribute('data-cell-id');

    if (cellId !== null && cellId !== undefined) {
      onCellAction(parseInt(cellId, 10));
    }
  };

  return (
    <div
      className="grid border border-neutral-700 bg-neutral-800"
      style={{
        width: gridWidth,
        height: gridHeight,
        gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
      }}
      onTouchMove={handleTouchMove}
    >
      {grid.map((color, index) => (
        <PixelCell
          key={index}
          id={index}
          color={color}
          size={cellSize}
          onMouseDown={() => handleCellMouseDown(index)}
          onMouseEnter={() => handleCellMouseEnter(index)}
          onTouchStart={() => handleCellTouchStart(index)}
        />
      ))}
    </div>
  );
}
