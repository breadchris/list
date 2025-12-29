// localStorage helpers for reading position caching

import type { ReadingPosition } from "@/types/reading-position";

const STORAGE_KEY_PREFIX = "reading-position:";

/**
 * Get reading position from localStorage
 */
export function getLocalReadingPosition(
  bookContentId: string
): ReadingPosition | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const key = `${STORAGE_KEY_PREFIX}${bookContentId}`;
    const stored = localStorage.getItem(key);

    if (!stored) {
      return null;
    }

    return JSON.parse(stored) as ReadingPosition;
  } catch (error) {
    console.warn("Failed to read reading position from localStorage:", error);
    return null;
  }
}

/**
 * Save reading position to localStorage
 */
export function setLocalReadingPosition(
  bookContentId: string,
  position: ReadingPosition
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = `${STORAGE_KEY_PREFIX}${bookContentId}`;
    localStorage.setItem(key, JSON.stringify(position));
  } catch (error) {
    console.warn("Failed to save reading position to localStorage:", error);
  }
}

/**
 * Clear reading position from localStorage
 */
export function clearLocalReadingPosition(bookContentId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = `${STORAGE_KEY_PREFIX}${bookContentId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("Failed to clear reading position from localStorage:", error);
  }
}

/**
 * Get all stored reading positions (for debugging/cleanup)
 */
export function getAllLocalReadingPositions(): Record<string, ReadingPosition> {
  if (typeof window === "undefined") {
    return {};
  }

  const positions: Record<string, ReadingPosition> = {};

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        const bookId = key.slice(STORAGE_KEY_PREFIX.length);
        const value = localStorage.getItem(key);
        if (value) {
          positions[bookId] = JSON.parse(value);
        }
      }
    }
  } catch (error) {
    console.warn("Failed to get all reading positions:", error);
  }

  return positions;
}
