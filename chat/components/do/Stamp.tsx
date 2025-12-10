"use client";

import type { Habit } from "./types";

interface StampProps {
  habit: Habit;
  hasInk: boolean;
  onClick: (e: React.MouseEvent | React.TouchEvent) => void;
}

export function Stamp({ habit, hasInk, onClick }: StampProps) {
  return (
    <button
      onMouseDown={onClick}
      onTouchStart={onClick}
      className="relative hover:scale-105 transition-transform cursor-grab active:cursor-grabbing"
    >
      {/* Stamp with handle */}
      <div className="flex flex-col items-center">
        {/* Wooden handle with concave sides */}
        <svg width="48" height="56" viewBox="0 0 48 56" className="drop-shadow-md">
          <defs>
            <linearGradient id={`woodGradient-${habit.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8b7355" />
              <stop offset="100%" stopColor="#6b5644" />
            </linearGradient>
          </defs>

          {/* Concave handle shape */}
          <path
            d="M 12 8 Q 12 18, 8 28 Q 6 36, 8 44 L 8 56 L 40 56 L 40 44 Q 42 36, 40 28 Q 36 18, 36 8 L 12 8 Z"
            fill={`url(#woodGradient-${habit.id})`}
          />

          {/* Wood grain texture overlay */}
          <pattern id={`woodGrain-${habit.id}`} x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="4" height="2" fill="rgba(0,0,0,0.1)" />
          </pattern>
          <path
            d="M 12 8 Q 12 18, 8 28 Q 6 36, 8 44 L 8 56 L 40 56 L 40 44 Q 42 36, 40 28 Q 36 18, 36 8 L 12 8 Z"
            fill={`url(#woodGrain-${habit.id})`}
            opacity="0.4"
          />

          {/* Wider top knob */}
          <ellipse
            cx="24"
            cy="6"
            rx="18"
            ry="7"
            fill="#a0826d"
          />
          <ellipse
            cx="24"
            cy="8"
            rx="18"
            ry="5"
            fill={`url(#woodGradient-${habit.id})`}
          />
        </svg>

        {/* Stamp base with icon preview */}
        <div
          className="w-16 h-16 rounded-sm flex items-center justify-center text-2xl shadow-lg relative -mt-1"
          style={{
            backgroundColor: hasInk ? habit.color : '#e8dcc8',
            border: '2px solid rgba(0,0,0,0.1)',
          }}
        >
          {/* Icon preview */}
          <div className={`absolute inset-0 flex items-center justify-center ${hasInk ? 'opacity-90' : 'opacity-40'}`}>
            {habit.icon}
          </div>

          {/* Rubber texture when no ink */}
          {!hasInk && (
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 6px)',
              }}
            ></div>
          )}

          {/* Ink drip effect when has ink */}
          {hasInk && (
            <>
              <div className="absolute -bottom-0.5 left-1/4 w-1 h-2 rounded-b-full opacity-70"
                style={{ backgroundColor: habit.color }}
              ></div>
              <div className="absolute -bottom-0.5 right-1/4 w-0.5 h-1.5 rounded-b-full opacity-60"
                style={{ backgroundColor: habit.color }}
              ></div>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
