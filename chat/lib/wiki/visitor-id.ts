'use client';

/**
 * Utilities for managing anonymous wiki visitor identities
 * Used for presence tracking in public wiki viewer
 */

const WIKI_VISITOR_KEY = 'wiki_visitor_id';

/**
 * Get or create a stable visitor ID for anonymous wiki visitors
 * Persisted in localStorage for consistent identity across sessions
 */
export function getOrCreateWikiVisitorId(): string {
  if (typeof window === 'undefined') {
    // SSR fallback
    return crypto.randomUUID();
  }

  const existing = localStorage.getItem(WIKI_VISITOR_KEY);
  if (existing) return existing;

  const newId = crypto.randomUUID();
  localStorage.setItem(WIKI_VISITOR_KEY, newId);
  return newId;
}

/**
 * Generate a consistent HSL color based on visitor ID
 * Same pattern as generateUserColor in webrtc-provider.ts
 */
export function generateVisitorColor(visitorId: string): string {
  let hash = 0;
  for (let i = 0; i < visitorId.length; i++) {
    hash = visitorId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Get contrasting text color for a background color
 */
export function getContrastColor(color: string): string {
  // Parse HSL
  if (color.startsWith('hsl')) {
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const lightness = parseInt(match[3], 10);
      return lightness > 50 ? '#000' : '#fff';
    }
  }

  // For hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000' : '#fff';
  }

  return '#fff';
}
