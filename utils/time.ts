
/**
 * Format seconds to MM:SS or HH:MM:SS format
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "00:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(secs)}`;
  }

  return `${padZero(minutes)}:${padZero(secs)}`;
}

/**
 * Pad a number with leading zero if needed
 */
function padZero(num: number): string {
  return num.toString().padStart(2, '0');
}

/**
 * Parse a time string (MM:SS or HH:MM:SS) to seconds
 */
export function parseTimeString(timeString: string): number {
  if (!timeString) return 0;

  const parts = timeString.split(':').map(Number);

  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }

  return 0;
}
