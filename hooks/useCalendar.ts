/**
 * useCalendar Hook
 *
 * Manages calendar state including current view, selected date,
 * and navigation controls.
 */

import { useState, useCallback, useMemo } from 'react';
import { CalendarView, CalendarState, DateRange } from '../types/CalendarTypes';
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  getDateRangeForView,
} from '../utils/calendarUtils';

interface UseCalendarOptions {
  initialView?: CalendarView;
  initialDate?: Date;
}

interface UseCalendarReturn {
  // State
  view: CalendarView;
  selectedDate: Date;
  currentMonth: Date;
  currentWeek: Date;
  currentYear: number;
  dateRange: DateRange;

  // Actions
  setView: (view: CalendarView) => void;
  setSelectedDate: (date: Date) => void;
  goToToday: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
  selectDate: (date: Date) => void;
}

/**
 * Hook for managing calendar state and navigation
 *
 * @param options - Configuration options
 * @returns Calendar state and navigation functions
 */
export function useCalendar(options: UseCalendarOptions = {}): UseCalendarReturn {
  const {
    initialView = 'month',
    initialDate = new Date(),
  } = options;

  // Core state
  const [view, setView] = useState<CalendarView>(initialView);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);

  // Derived state for current viewing context
  const currentMonth = useMemo(() => {
    return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  }, [selectedDate]);

  const currentWeek = useMemo(() => {
    return new Date(selectedDate);
  }, [selectedDate]);

  const currentYear = useMemo(() => {
    return selectedDate.getFullYear();
  }, [selectedDate]);

  // Date range for current view
  const dateRange = useMemo(() => {
    return getDateRangeForView(selectedDate, view);
  }, [selectedDate, view]);

  /**
   * Navigate to today's date
   */
  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  /**
   * Navigate to previous period (day/week/month/year)
   */
  const goToPrevious = useCallback(() => {
    setSelectedDate((current) => {
      switch (view) {
        case 'day':
          return addDays(current, -1);
        case 'week':
          return addWeeks(current, -1);
        case 'month':
          return addMonths(current, -1);
        case 'year':
          return addYears(current, -1);
        default:
          return current;
      }
    });
  }, [view]);

  /**
   * Navigate to next period (day/week/month/year)
   */
  const goToNext = useCallback(() => {
    setSelectedDate((current) => {
      switch (view) {
        case 'day':
          return addDays(current, 1);
        case 'week':
          return addWeeks(current, 1);
        case 'month':
          return addMonths(current, 1);
        case 'year':
          return addYears(current, 1);
        default:
          return current;
      }
    });
  }, [view]);

  /**
   * Select a specific date
   */
  const selectDate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  return {
    // State
    view,
    selectedDate,
    currentMonth,
    currentWeek,
    currentYear,
    dateRange,

    // Actions
    setView,
    setSelectedDate,
    goToToday,
    goToPrevious,
    goToNext,
    selectDate,
  };
}
