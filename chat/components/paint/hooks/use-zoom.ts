"use client";

import { useState, useCallback } from "react";
import {
  MIN_ZOOM_LEVEL,
  MAX_ZOOM_LEVEL,
  DEFAULT_ZOOM_LEVEL,
  ZOOM_STEP,
} from "../constants";

interface UseZoomOptions {
  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;
}

interface UseZoomReturn {
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitToContainer: (
    containerWidth: number,
    containerHeight: number,
    gridColumns: number,
    gridRows: number,
    baseCellSize: number
  ) => void;
  getEffectiveCellSize: (baseCellSize: number) => number;
}

export function useZoom(options: UseZoomOptions = {}): UseZoomReturn {
  const {
    initialZoom = DEFAULT_ZOOM_LEVEL,
    minZoom = MIN_ZOOM_LEVEL,
    maxZoom = MAX_ZOOM_LEVEL,
  } = options;

  const [zoomLevel, setZoomLevelState] = useState(initialZoom);

  const clampZoom = useCallback(
    (zoom: number) => Math.max(minZoom, Math.min(maxZoom, zoom)),
    [minZoom, maxZoom]
  );

  const setZoomLevel = useCallback(
    (zoom: number) => {
      setZoomLevelState(clampZoom(zoom));
    },
    [clampZoom]
  );

  const zoomIn = useCallback(() => {
    setZoomLevelState((prev) => clampZoom(prev + ZOOM_STEP));
  }, [clampZoom]);

  const zoomOut = useCallback(() => {
    setZoomLevelState((prev) => clampZoom(prev - ZOOM_STEP));
  }, [clampZoom]);

  const resetZoom = useCallback(() => {
    setZoomLevelState(DEFAULT_ZOOM_LEVEL);
  }, []);

  const fitToContainer = useCallback(
    (
      containerWidth: number,
      containerHeight: number,
      gridColumns: number,
      gridRows: number,
      baseCellSize: number
    ) => {
      const gridBaseWidth = gridColumns * baseCellSize;
      const gridBaseHeight = gridRows * baseCellSize;

      // Add padding (20px on each side)
      const availableWidth = containerWidth - 40;
      const availableHeight = containerHeight - 40;

      const zoomX = availableWidth / gridBaseWidth;
      const zoomY = availableHeight / gridBaseHeight;

      // Use the smaller zoom to fit both dimensions
      const fitZoom = Math.min(zoomX, zoomY);
      setZoomLevel(clampZoom(fitZoom));
    },
    [setZoomLevel, clampZoom]
  );

  const getEffectiveCellSize = useCallback(
    (baseCellSize: number) => {
      return Math.round(baseCellSize * zoomLevel);
    },
    [zoomLevel]
  );

  return {
    zoomLevel,
    setZoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToContainer,
    getEffectiveCellSize,
  };
}
