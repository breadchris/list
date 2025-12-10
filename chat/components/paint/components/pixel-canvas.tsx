"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useCanvasState } from "../hooks/use-paint-state";
import { usePaintActions } from "../hooks/use-paint-actions";
import { useZoom } from "../hooks/use-zoom";
import { PixelGrid } from "./pixel-grid";
import { ZoomControls } from "./zoom-controls";
import { DRAWING_TOOLS } from "../types";
import { WHEEL_ZOOM_FACTOR } from "../constants";

interface PixelCanvasProps {
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export function PixelCanvas({ containerRef: externalContainerRef }: PixelCanvasProps) {
  const canvasState = useCanvasState();
  const { cellAction, moveDrawing } = usePaintActions();
  const [isDragging, setIsDragging] = useState(false);
  const [lastDragPosition, setLastDragPosition] = useState<{ x: number; y: number } | null>(null);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Pinch-to-zoom touch tracking
  const touchStartDistanceRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1);

  const { grid, columns, rows, drawing_tool, palette_color, cell_size } = canvasState;

  // Local zoom state
  const {
    zoomLevel,
    setZoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToContainer,
    getEffectiveCellSize,
  } = useZoom();

  // Calculate effective cell size for rendering
  const effectiveCellSize = getEffectiveCellSize(cell_size);

  // Handle fit to container
  const handleFitToScreen = useCallback(() => {
    const container = externalContainerRef?.current || internalContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    fitToContainer(rect.width, rect.height, columns, rows, cell_size);
  }, [externalContainerRef, fitToContainer, columns, rows, cell_size]);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          zoomIn();
        } else if (e.key === "-") {
          e.preventDefault();
          zoomOut();
        } else if (e.key === "0") {
          e.preventDefault();
          resetZoom();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);

  // Handle wheel zoom (Ctrl + scroll)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // deltaY < 0 = scroll up = zoom in
        const delta = -e.deltaY * WHEEL_ZOOM_FACTOR;
        setZoomLevel(zoomLevel + delta);
      }
    },
    [zoomLevel, setZoomLevel]
  );

  // Prevent default browser zoom on the canvas area
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventDefaultZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    canvas.addEventListener("wheel", preventDefaultZoom, { passive: false });
    return () => canvas.removeEventListener("wheel", preventDefaultZoom);
  }, []);

  // Calculate distance between two touch points
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle touch start for pinch-to-zoom
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // Start pinch gesture
        touchStartDistanceRef.current = getTouchDistance(e.touches);
        touchStartZoomRef.current = zoomLevel;
      } else if (e.touches.length === 1 && drawing_tool === DRAWING_TOOLS.MOVE) {
        setLastDragPosition({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        });
      }
    },
    [zoomLevel, drawing_tool]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setLastDragPosition(null);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || drawing_tool !== DRAWING_TOOLS.MOVE || !lastDragPosition) return;

      const x_diff = e.clientX - lastDragPosition.x;
      const y_diff = e.clientY - lastDragPosition.y;

      if (Math.abs(x_diff) > effectiveCellSize || Math.abs(y_diff) > effectiveCellSize) {
        moveDrawing({ x_diff, y_diff, cell_width: effectiveCellSize });
        setLastDragPosition({ x: e.clientX, y: e.clientY });
      }
    },
    [isDragging, drawing_tool, lastDragPosition, effectiveCellSize, moveDrawing]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (drawing_tool === DRAWING_TOOLS.MOVE) {
        setLastDragPosition({ x: e.clientX, y: e.clientY });
      }
    },
    [drawing_tool]
  );

  // Handle touch move for pinch-to-zoom and move tool
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && touchStartDistanceRef.current !== null) {
        // Handle pinch gesture
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches);
        const scale = currentDistance / touchStartDistanceRef.current;
        setZoomLevel(touchStartZoomRef.current * scale);
      } else if (isDragging && drawing_tool === DRAWING_TOOLS.MOVE && lastDragPosition) {
        // Existing move logic
        if (e.touches.length === 0) return;
        const touch = e.touches[0];
        const x_diff = touch.clientX - lastDragPosition.x;
        const y_diff = touch.clientY - lastDragPosition.y;

        if (Math.abs(x_diff) > effectiveCellSize || Math.abs(y_diff) > effectiveCellSize) {
          moveDrawing({ x_diff, y_diff, cell_width: effectiveCellSize });
          setLastDragPosition({ x: touch.clientX, y: touch.clientY });
        }
      }
    },
    [isDragging, drawing_tool, lastDragPosition, effectiveCellSize, moveDrawing, setZoomLevel]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    touchStartDistanceRef.current = null;
    setIsDragging(false);
    setLastDragPosition(null);
  }, []);

  const handleCellAction = useCallback(
    (id: number) => {
      cellAction({
        id,
        drawing_tool,
        color: grid[id] || "",
        palette_color,
        columns,
        rows,
      });
    },
    [cellAction, drawing_tool, grid, palette_color, columns, rows]
  );

  // Cursor classes based on tool
  const getCursorClass = () => {
    switch (drawing_tool) {
      case DRAWING_TOOLS.PENCIL:
        return "cursor-cell";
      case DRAWING_TOOLS.ERASER:
        return "cursor-crosshair";
      case DRAWING_TOOLS.BUCKET:
        return "cursor-crosshair";
      case DRAWING_TOOLS.EYEDROPPER:
        return "cursor-copy";
      case DRAWING_TOOLS.MOVE:
        return "cursor-move";
      default:
        return "cursor-cell";
    }
  };

  return (
    <div ref={internalContainerRef} className="flex flex-col items-center gap-2">
      {/* Zoom Controls */}
      <ZoomControls
        zoomLevel={zoomLevel}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        onFitToScreen={handleFitToScreen}
      />

      {/* Canvas Container */}
      <div
        ref={canvasRef}
        className={`touch-none select-none ${getCursorClass()}`}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <PixelGrid
          grid={grid}
          columns={columns}
          rows={rows}
          cellSize={effectiveCellSize}
          onCellAction={handleCellAction}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
        />
      </div>
    </div>
  );
}
