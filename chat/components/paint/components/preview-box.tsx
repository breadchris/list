"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { usePreviewData } from "../hooks/use-paint-state";
import { generateInlineBoxShadow } from "../utils/css-generator";

// Preview cell size
const PREVIEW_CELL_SIZE = 3;

export function PreviewBox() {
  const { frames, columns, rows, duration, active_frame_index } = usePreviewData();
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const previewWidth = columns * PREVIEW_CELL_SIZE;
  const previewHeight = rows * PREVIEW_CELL_SIZE;

  const hasAnimation = frames.length > 1;

  // Animation loop
  useEffect(() => {
    if (!hasAnimation || !isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const totalInterval = frames.reduce((sum, f) => sum + f.interval, 0);
    const frameDelay = (duration * 1000) / frames.length;

    let frameIndex = 0;
    intervalRef.current = setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      setCurrentFrameIndex(frameIndex);
    }, frameDelay);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasAnimation, isPlaying, frames.length, duration, frames]);

  // Get the frame to display
  const displayFrame = hasAnimation && isPlaying
    ? frames[currentFrameIndex]
    : frames[active_frame_index];

  // Generate box-shadow for preview
  const boxShadow = useMemo(() => {
    if (!displayFrame) return "";
    return generateInlineBoxShadow(displayFrame.grid, columns, PREVIEW_CELL_SIZE);
  }, [displayFrame, columns]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
          Preview
        </span>
        {hasAnimation && (
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      <div className="flex items-center justify-center p-2 bg-neutral-800 rounded-lg">
        <div
          className="relative"
          style={{
            width: previewWidth,
            height: previewHeight,
          }}
        >
          {/* Background */}
          <div
            className="absolute inset-0 bg-neutral-700"
            style={{
              width: previewWidth,
              height: previewHeight,
            }}
          />
          {/* Pixel art */}
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
      </div>

      {hasAnimation && (
        <div className="text-center text-xs text-neutral-500">
          Frame {currentFrameIndex + 1}/{frames.length}
        </div>
      )}
    </div>
  );
}
