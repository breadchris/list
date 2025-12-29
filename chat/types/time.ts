/**
 * Types for Time/Calendar App
 * A collaborative calendar with multiple views and real-time sync
 */

/**
 * Calendar view types
 */
export type TimeViewType = "month" | "week" | "day" | "schedule";

/**
 * A calendar event stored in Y.js for real-time collaboration
 */
export interface TimeEvent {
  /** Unique event ID */
  id: string;
  /** Event title */
  title: string;
  /** Start time as ISO 8601 string */
  start_time: string;
  /** End time as ISO 8601 string */
  end_time: string;
  /** User who created the event */
  user_id: string;
  /** Display name of the user */
  user_name?: string;
  /** Color for the event (auto-assigned based on user) */
  user_color?: string;
  /** Optional event description */
  description?: string;
  /** ISO timestamp when event was created */
  created_at: string;
  /** ISO timestamp when event was last updated */
  updated_at: string;
}

/**
 * A calendar container stored in Supabase content table
 */
export interface TimeCalendar {
  id: string;
  name: string;
  group_id: string;
  created_at: string;
  updated_at: string;
  settings?: TimeCalendarSettings;
}

/**
 * User settings for the calendar
 */
export interface TimeCalendarSettings {
  /** Default view when opening the calendar */
  default_view: TimeViewType;
  /** Week start day: 0 = Sunday, 1 = Monday */
  week_start: 0 | 1;
}

/**
 * Metadata stored in content.metadata for calendar
 */
export interface TimeCalendarMetadata {
  /** Calendar display title */
  title?: string;
  /** Creator username */
  created_by_username?: string;
  /** Calendar settings */
  settings?: TimeCalendarSettings;
}

/**
 * Content type constants
 */
export const TIME_CONTENT_TYPE = "time" as const;

/**
 * Default calendar settings
 */
export const DEFAULT_TIME_SETTINGS: TimeCalendarSettings = {
  default_view: "week",
  week_start: 0,
};

/**
 * User colors for event display (cycle through these based on user index)
 */
export const USER_COLORS = [
  "#3b82f6", // blue-500
  "#22c55e", // green-500
  "#f59e0b", // amber-500
  "#ec4899", // pink-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#14b8a6", // teal-500
] as const;

/**
 * Get a consistent color for a user based on their ID
 */
export function getUserColor(userId: string): string {
  // Simple hash to get consistent color per user
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash = hash & hash;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}
