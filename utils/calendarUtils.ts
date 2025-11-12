/**
 * Calendar Utility Functions
 *
 * Date manipulation helpers for the calendar system.
 * Uses standard JavaScript Date API without external dependencies.
 */

import { CalendarDay, CalendarWeek, CalendarMonth, DateRange } from '../types/CalendarTypes';

/**
 * Get the number of days in a specific month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the first day of the month (0 = Sunday, 6 = Saturday)
 */
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Get the last day of the month (0 = Sunday, 6 = Saturday)
 */
export function getLastDayOfMonth(year: number, month: number): number {
  const daysInMonth = getDaysInMonth(year, month);
  return new Date(year, month, daysInMonth).getDay();
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Get the start of the week for a given date (Sunday)
 */
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

/**
 * Get the end of the week for a given date (Saturday)
 */
export function getEndOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() + (6 - day);
  return new Date(d.setDate(diff));
}

/**
 * Get week number of the year (1-53)
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Format date as "January 2024"
 */
export function formatMonthYear(date: Date): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Format date as "Mon Jan 15"
 */
export function formatShortDate(date: Date): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dayNames[date.getDay()]} ${monthNames[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Format date as "Monday, January 15, 2024"
 */
export function formatLongDate(date: Date): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Format time as "2:00 PM" from Date object
 */
export function formatTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Get array of dates for a week
 */
export function getWeekDays(startDate: Date): Date[] {
  const days: Date[] = [];
  const start = getStartOfWeek(startDate);

  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }

  return days;
}

/**
 * Get array of all days in a month grid (includes previous/next month days)
 */
export function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    days.push(new Date(prevYear, prevMonth, daysInPrevMonth - i));
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  // Next month days (to fill grid to 42 days / 6 weeks)
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    days.push(new Date(nextYear, nextMonth, i));
  }

  return days;
}

/**
 * Get date range for a specific view
 */
export function getDateRangeForView(date: Date, view: 'day' | 'week' | 'month' | 'year'): DateRange {
  const start = new Date(date);
  const end = new Date(date);

  switch (view) {
    case 'day':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'week':
      const weekStart = getStartOfWeek(date);
      const weekEnd = getEndOfWeek(date);
      start.setTime(weekStart.getTime());
      start.setHours(0, 0, 0, 0);
      end.setTime(weekEnd.getTime());
      end.setHours(23, 59, 59, 999);
      break;

    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;

    case 'year':
      start.setMonth(0);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11);
      end.setDate(31);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

/**
 * Add/subtract days from a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add/subtract weeks from a date
 */
export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/**
 * Add/subtract months from a date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Add/subtract years from a date
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

/**
 * Get all months in a year
 */
export function getMonthsInYear(year: number): Date[] {
  const months: Date[] = [];
  for (let i = 0; i < 12; i++) {
    months.push(new Date(year, i, 1));
  }
  return months;
}

/**
 * Get short month name (Jan, Feb, etc.)
 */
export function getShortMonthName(month: number): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return monthNames[month];
}

/**
 * Get full month name (January, February, etc.)
 */
export function getFullMonthName(month: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[month];
}

/**
 * Get short day name (Sun, Mon, etc.)
 */
export function getShortDayName(day: number): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dayNames[day];
}

/**
 * Get full day name (Sunday, Monday, etc.)
 */
export function getFullDayName(day: number): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNames[day];
}

/**
 * Get hours of the day for day/week view (0-23)
 */
export function getDayHours(): number[] {
  return Array.from({ length: 24 }, (_, i) => i);
}

/**
 * Format hour as "12 AM", "1 PM", etc.
 */
export function formatHour(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour} ${ampm}`;
}

/**
 * Build calendar days with events grouped by date
 * Used by MonthView to create the calendar grid with event data
 */
export function buildCalendarDays(
  year: number,
  month: number,
  events: Array<{ id: string; date: Date; [key: string]: any }>,
  selectedDate: Date
): Array<{
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: Array<{ id: string; date: Date; [key: string]: any }>;
}> {
  const monthDays = getMonthDays(year, month);
  const today = new Date();

  return monthDays.map((date) => {
    // Filter events for this specific date
    const dayEvents = events.filter((event) =>
      isSameDay(event.date, date)
    );

    return {
      date,
      isCurrentMonth: date.getMonth() === month,
      isToday: isSameDay(date, today),
      isSelected: isSameDay(date, selectedDate),
      events: dayEvents,
    };
  });
}

/**
 * Parse time string to hours and minutes
 * Supports formats: "14:30", "2:30 PM", "2:30pm"
 */
export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const time = timeStr.trim().toLowerCase();

  // Check for AM/PM format
  const isPM = time.includes('pm');
  const isAM = time.includes('am');

  // Extract time part (remove am/pm)
  const timePart = time.replace(/\s*(am|pm)\s*/g, '').trim();
  const [hoursStr, minutesStr = '0'] = timePart.split(':');

  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  // Convert to 24-hour format
  if (isPM && hours !== 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  return { hours, minutes };
}

/**
 * Calculate grid row for event time
 * Returns row number (2-289) for 288 five-minute intervals + 1 header row
 * Row 2 = 12:00 AM, Row 74 = 6:00 AM, Row 289 = 11:55 PM
 */
export function calculateTimeSlotRow(time: string): number {
  try {
    const { hours, minutes } = parseTime(time);
    // 288 total rows = 24 hours × 12 intervals (5 minutes each)
    // Add 2 for offset (1 for header row, 1 for grid indexing)
    const intervalsPassed = (hours * 12) + Math.floor(minutes / 5);
    return intervalsPassed + 2;
  } catch (error) {
    // Default to midnight if parsing fails
    return 2;
  }
}

/**
 * Calculate span for event duration
 * Returns number of grid rows to span
 */
export function calculateDurationSpan(startTime: string, endTime: string): number {
  try {
    const start = parseTime(startTime);
    const end = parseTime(endTime);

    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;
    const duration = endMinutes - startMinutes;

    // Each row = 5 minutes, so divide duration by 5
    const span = Math.ceil(duration / 5);

    // Minimum span of 3 (15 minutes) for visibility
    return Math.max(span, 3);
  } catch (error) {
    // Default to 1 hour (12 intervals)
    return 12;
  }
}

/**
 * Build week days with events grouped by date
 * Used by WeekView to create the week grid with event data
 */
export function buildWeekDays(
  startDate: Date,
  events: Array<{ id: string; date: Date; [key: string]: any }>,
  selectedDate: Date
): Array<{
  date: Date;
  isToday: boolean;
  isSelected: boolean;
  dayOfWeek: number;
  events: Array<{ id: string; date: Date; [key: string]: any }>;
}> {
  const weekDays = getWeekDays(startDate);
  const today = new Date();

  return weekDays.map((date, index) => {
    // Filter events for this specific date
    const dayEvents = events.filter((event) =>
      isSameDay(event.date, date)
    );

    return {
      date,
      isToday: isSameDay(date, today),
      isSelected: isSameDay(date, selectedDate),
      dayOfWeek: index, // 0 = Sunday, 6 = Saturday
      events: dayEvents,
    };
  });
}

/**
 * Build year months with events
 * Used by YearView to create the year grid with event data
 */
export function buildYearMonths(
  year: number,
  events: Array<{ id: string; date: Date; [key: string]: any }>,
  selectedDate: Date
): Array<{
  month: number;
  name: string;
  days: Array<{
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    hasEvents: boolean;
    eventCount: number;
  }>;
}> {
  const months = getMonthsInYear(year);
  const today = new Date();

  return months.map((monthDate, monthIndex) => {
    const monthDays = getMonthDays(year, monthIndex);

    const days = monthDays.map((date) => {
      // Filter events for this specific date
      const dayEvents = events.filter((event) =>
        isSameDay(event.date, date)
      );

      return {
        date,
        isCurrentMonth: date.getMonth() === monthIndex,
        isToday: isSameDay(date, today),
        isSelected: isSameDay(date, selectedDate),
        hasEvents: dayEvents.length > 0,
        eventCount: dayEvents.length,
      };
    });

    return {
      month: monthIndex,
      name: getFullMonthName(monthIndex),
      days,
    };
  });
}
