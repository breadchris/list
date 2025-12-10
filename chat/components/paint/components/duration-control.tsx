"use client";

import React from "react";
import { useDuration, useFrameCount } from "../hooks/use-paint-state";
import { usePaintActions } from "../hooks/use-paint-actions";
import { MIN_DURATION, MAX_DURATION } from "../constants";

export function DurationControl() {
  const duration = useDuration();
  const frameCount = useFrameCount();
  const { setDuration } = usePaintActions();

  const handleDurationChange = (value: number) => {
    if (value >= MIN_DURATION && value <= MAX_DURATION) {
      setDuration(value);
    }
  };

  // Only show if there's more than one frame (animation)
  if (frameCount <= 1) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
        Animation
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400">Duration</span>
          <span className="text-xs text-neutral-500">{duration.toFixed(1)}s</span>
        </div>
        <input
          type="range"
          min={MIN_DURATION}
          max={MAX_DURATION}
          step={0.1}
          value={duration}
          onChange={(e) => handleDurationChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-neutral-600">
          <span>Fast</span>
          <span>Slow</span>
        </div>
      </div>
    </div>
  );
}
