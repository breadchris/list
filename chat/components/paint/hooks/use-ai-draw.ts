"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import {
  aiDrawResponseSchema,
  type PixelOperation,
} from "../schemas/ai-draw-schema";
import { usePaintActions } from "./use-paint-actions";
import { useActiveFrameGrid, useGridDimensions } from "./use-paint-state";
import { DRAWING_TOOLS } from "../types";

interface UseAIDrawOptions {
  /** Delay between pixel operations in ms (for animation effect) */
  pixelDelay?: number;
  /** Callback when drawing starts */
  onStart?: () => void;
  /** Callback when drawing completes */
  onComplete?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

interface AIDrawProgress {
  current: number;
  total: number;
}

export function useAIDraw(options: UseAIDrawOptions = {}) {
  const { pixelDelay = 50, onStart, onComplete, onError } = options;

  const { cellAction } = usePaintActions();
  const { columns, rows } = useGridDimensions();
  const grid = useActiveFrameGrid();

  const [isDrawing, setIsDrawing] = useState(false);
  const [progress, setProgress] = useState<AIDrawProgress>({
    current: 0,
    total: 0,
  });

  const processedCountRef = useRef(0);
  const pixelQueueRef = useRef<PixelOperation[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastPixelTimeRef = useRef(0);
  const isActiveRef = useRef(false);

  const { object, submit, isLoading, error, stop } = useObject({
    api: "/api/paint-ai",
    schema: aiDrawResponseSchema,
  });

  // Process pixels with animation delay
  const processNextPixel = useCallback(() => {
    if (!isActiveRef.current) return;

    const now = Date.now();
    if (now - lastPixelTimeRef.current < pixelDelay) {
      animationFrameRef.current = requestAnimationFrame(processNextPixel);
      return;
    }

    if (processedCountRef.current < pixelQueueRef.current.length) {
      const pixel = pixelQueueRef.current[processedCountRef.current];

      // Validate coordinates
      if (
        pixel.x >= 0 &&
        pixel.x < columns &&
        pixel.y >= 0 &&
        pixel.y < rows
      ) {
        const index = pixel.y * columns + pixel.x;

        // Use cellAction with PENCIL tool to set the color
        cellAction({
          id: index,
          drawing_tool: DRAWING_TOOLS.PENCIL,
          color: pixel.color,
          palette_color: pixel.color,
          columns,
          rows,
        });
      }

      processedCountRef.current++;
      lastPixelTimeRef.current = now;
      setProgress({
        current: processedCountRef.current,
        total: pixelQueueRef.current.length,
      });

      if (processedCountRef.current < pixelQueueRef.current.length) {
        animationFrameRef.current = requestAnimationFrame(processNextPixel);
      } else {
        animationFrameRef.current = null;
      }
    }
  }, [cellAction, columns, rows, pixelDelay]);

  // Watch for new pixels in the streamed object
  useEffect(() => {
    if (!object?.pixels || !isActiveRef.current) return;

    const pixels = object.pixels as PixelOperation[];

    // Add new pixels to queue
    if (pixels.length > pixelQueueRef.current.length) {
      pixelQueueRef.current = [...pixels];
      setProgress({
        current: processedCountRef.current,
        total: pixelQueueRef.current.length,
      });

      // Start processing if not already running
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(processNextPixel);
      }
    }
  }, [object?.pixels, processNextPixel]);

  // Handle completion
  useEffect(() => {
    if (
      !isLoading &&
      isActiveRef.current &&
      processedCountRef.current >= pixelQueueRef.current.length &&
      pixelQueueRef.current.length > 0
    ) {
      // Wait a bit for any remaining animation frames
      const timeout = setTimeout(() => {
        if (processedCountRef.current >= pixelQueueRef.current.length) {
          setIsDrawing(false);
          isActiveRef.current = false;
          onComplete?.();
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, onComplete]);

  // Handle errors
  useEffect(() => {
    if (error && isActiveRef.current) {
      setIsDrawing(false);
      isActiveRef.current = false;
      onError?.(error.message || "AI drawing failed");
    }
  }, [error, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Submit drawing request
  const draw = useCallback(
    (prompt: string) => {
      // Reset state
      processedCountRef.current = 0;
      pixelQueueRef.current = [];
      animationFrameRef.current = null;
      lastPixelTimeRef.current = 0;
      setProgress({ current: 0, total: 0 });
      setIsDrawing(true);
      isActiveRef.current = true;
      onStart?.();

      // Submit to API
      submit({
        prompt,
        columns,
        rows,
        current_grid: grid,
      });
    },
    [submit, columns, rows, grid, onStart]
  );

  // Cancel ongoing drawing
  const cancel = useCallback(() => {
    stop();
    isActiveRef.current = false;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsDrawing(false);
  }, [stop]);

  return {
    draw,
    cancel,
    isDrawing,
    isLoading,
    progress,
    thinking: object?.thinking,
    error: error?.message,
  };
}
