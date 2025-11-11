/**
 * Calendar System Type Definitions
 *
 * Defines types for the unified calendar system that supports
 * multiple views (day, week, month, year) and integrates with
 * the content system for event data.
 */

import { Content } from '../components/ContentRepository';

/**
 * Calendar view modes
 */
export type CalendarView = 'day' | 'week' | 'month' | 'year';

/**
 * Calendar event representing a content item or dedicated event
 */
export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  time?: string; // Optional time (e.g., "2:00 PM" or "14:00")
  end_time?: string; // Optional end time
  color?: string; // Event color (from tag or content type)
  content_id: string; // Reference to original content item
  content_type: string; // Type of content (text, url, image, etc.)
  metadata?: any; // Additional metadata from content
  tags?: Array<{ id: string; name: string; color: string | null }>;
}

/**
 * Calendar state for managing current view and selected date
 */
export interface CalendarState {
  view: CalendarView;
  selectedDate: Date;
  currentMonth: Date; // For month view - which month is displayed
  currentWeek: Date; // For week view - which week is displayed
  currentYear: number; // For year view - which year is displayed
}

/**
 * Day data for calendar grid rendering
 */
export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean; // Whether day belongs to current viewing month
  isToday: boolean; // Whether day is today
  isSelected: boolean; // Whether day is currently selected
  events: CalendarEvent[]; // Events on this day
}

/**
 * Week data for calendar rendering
 */
export interface CalendarWeek {
  weekNumber: number;
  days: CalendarDay[];
  startDate: Date;
  endDate: Date;
}

/**
 * Month data for calendar rendering
 */
export interface CalendarMonth {
  month: number; // 0-11 (JavaScript Date month)
  year: number;
  weeks: CalendarWeek[];
  monthName: string; // e.g., "January"
}

/**
 * Filter options for calendar events
 */
export interface CalendarFilters {
  tagIds?: string[]; // Filter by tag IDs
  contentTypes?: string[]; // Filter by content type (text, url, image, etc.)
  searchQuery?: string; // Text search in event titles
}

/**
 * Date range for querying events
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Props for calendar navigation controls
 */
export interface CalendarNavigationProps {
  currentDate: Date;
  view: CalendarView;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
}

/**
 * Props for calendar event item rendering
 */
export interface CalendarEventItemProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
  compact?: boolean; // Compact rendering for small spaces
}

/**
 * Configuration for mapping content to calendar events
 */
export interface ContentToEventMapping {
  useCreatedAt: boolean; // Use content created_at as event date
  useDedicatedEvents: boolean; // Include content items with type 'event'
  extractTimeFromMetadata: boolean; // Try to extract time from metadata
  defaultColor?: string; // Default event color if no tag color
}
