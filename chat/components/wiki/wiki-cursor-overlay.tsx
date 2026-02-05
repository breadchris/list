'use client';

/**
 * Cursor overlay component for wiki presence
 * Renders other users' cursors as floating elements over the editor
 */

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WikiPresenceUser } from '@/types/wiki';
import { getContrastColor } from '@/lib/wiki/visitor-id';

export interface WikiCursorOverlayProps {
  viewers: WikiPresenceUser[];
}

/**
 * Overlay container for rendering user cursors
 */
export const WikiCursorOverlay = memo(function WikiCursorOverlay({
  viewers,
}: WikiCursorOverlayProps) {
  // Filter viewers with valid cursor positions
  const viewersWithCursors = viewers.filter(v => v.cursor_position !== null);

  if (viewersWithCursors.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-50">
      <AnimatePresence>
        {viewersWithCursors.map(viewer => (
          <WikiCursor key={viewer.client_id} viewer={viewer} />
        ))}
      </AnimatePresence>
    </div>
  );
});

interface WikiCursorProps {
  viewer: WikiPresenceUser;
}

/**
 * Individual cursor with arrow and name label
 */
const WikiCursor = memo(function WikiCursor({ viewer }: WikiCursorProps) {
  const { cursor_position, display_name, color } = viewer;

  if (!cursor_position) return null;

  return (
    <motion.div
      className="pointer-events-none"
      style={{ position: 'absolute', zIndex: 9999 }}
      initial={{ opacity: 0, scale: 0.5, x: cursor_position.x, y: cursor_position.y }}
      animate={{
        opacity: 1,
        scale: 1,
        x: cursor_position.x,
        y: cursor_position.y,
      }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{
        x: { type: 'spring', stiffness: 500, damping: 30 },
        y: { type: 'spring', stiffness: 500, damping: 30 },
        opacity: { duration: 0.15 },
        scale: { duration: 0.15 },
      }}
    >
      {/* Cursor arrow SVG */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
      >
        <path
          d="M0 0 L0 14 L4 10 L7 16 L9 15 L6 9 L12 9 Z"
          fill={color}
          stroke="white"
          strokeWidth="1"
        />
      </svg>

      {/* Name label */}
      <div
        className="absolute left-4 top-3 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap shadow-sm"
        style={{
          backgroundColor: color,
          color: getContrastColor(color),
        }}
      >
        {display_name}
      </div>
    </motion.div>
  );
});
