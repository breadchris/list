import React from 'react';
import type { TimelineControlsProps } from './types';
import { formatTimelineTime } from './types';

export default function TimelineControls({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSkipBackward,
  onSkipForward,
  onMark,
  disabled = false,
}: TimelineControlsProps) {
  return (
    <div className="flex flex-col items-center w-full space-y-4">
      {/* Time Display */}
      <div className="text-center">
        <div className="text-4xl font-bold tabular-nums tracking-tight">
          {formatTimelineTime(currentTime)}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          {formatTimelineTime(duration)}
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-center space-x-8">
        {/* Skip Backward 15s */}
        <button
          onClick={() => onSkipBackward(15)}
          disabled={disabled || currentTime === 0}
          className="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Skip backward 15 seconds"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 18l-6-6 6-6" />
            <path d="M21 18l-6-6 6-6" />
          </svg>
          <span className="absolute text-xs font-bold mt-5">15</span>
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={onPlayPause}
          disabled={disabled}
          className="flex items-center justify-center w-20 h-20 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            // Pause Icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-10 h-10"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            // Play Icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-10 h-10 ml-1"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Skip Forward 15s */}
        <button
          onClick={() => onSkipForward(15)}
          disabled={disabled || currentTime >= duration}
          className="flex items-center justify-center w-12 h-12 rounded-full hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Skip forward 15 seconds"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 6l6 6-6 6" />
            <path d="M3 6l6 6-6 6" />
          </svg>
          <span className="absolute text-xs font-bold mt-5">15</span>
        </button>
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex items-center justify-center space-x-4 w-full px-4">
        {/* Mark Button */}
        <button
          onClick={onMark}
          disabled={disabled}
          className="flex items-center justify-center px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md"
          title="Mark this moment"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 mr-2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v20" />
            <path d="M2 12h20" />
          </svg>
          Mark
        </button>
      </div>
    </div>
  );
}
