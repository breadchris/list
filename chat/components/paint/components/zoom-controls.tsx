"use client";

import React from "react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL } from "../constants";

interface ZoomControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToScreen: () => void;
  minZoom?: number;
  maxZoom?: number;
}

export function ZoomControls({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  minZoom = MIN_ZOOM_LEVEL,
  maxZoom = MAX_ZOOM_LEVEL,
}: ZoomControlsProps) {
  const zoomPercent = Math.round(zoomLevel * 100);

  return (
    <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-1">
      <button
        onClick={onZoomOut}
        disabled={zoomLevel <= minZoom}
        className="p-1.5 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-neutral-400"
        title="Zoom Out (Ctrl+-)"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <button
        onClick={onResetZoom}
        className="px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 rounded min-w-[50px]"
        title="Reset to 100%"
      >
        {zoomPercent}%
      </button>

      <button
        onClick={onZoomIn}
        disabled={zoomLevel >= maxZoom}
        className="p-1.5 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-neutral-400"
        title="Zoom In (Ctrl++)"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-neutral-700 mx-1" />

      <button
        onClick={onFitToScreen}
        className="p-1.5 hover:bg-neutral-700 rounded text-neutral-400"
        title="Fit to Screen"
      >
        <Maximize className="w-4 h-4" />
      </button>
    </div>
  );
}
