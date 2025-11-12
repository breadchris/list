/**
 * Calendar Page Component
 *
 * Main calendar interface that supports multiple views (month, week, day, year)
 * and displays content items as calendar events.
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendar } from '../hooks/useCalendar';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { CalendarView, CalendarFilters, CalendarEvent } from '../types/CalendarTypes';
import { formatMonthYear } from '../utils/calendarUtils';
import { MonthView } from './MonthView';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { YearView } from './YearView';

/**
 * Calendar Page
 * Displays content items as calendar events with multiple view modes
 */
export const CalendarPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  // Calendar state management
  const {
    view,
    selectedDate,
    currentMonth,
    currentWeek,
    currentYear,
    dateRange,
    setView,
    goToToday,
    goToPrevious,
    goToNext,
    selectDate,
  } = useCalendar({
    initialView: 'month',
    initialDate: new Date(),
  });

  // Event filters
  const [filters, setFilters] = useState<CalendarFilters>({});

  // Fetch calendar events
  const {
    data: events = [],
    isLoading,
  } = useCalendarEvents({
    groupId: groupId || '',
    dateRange,
    filters,
    enabled: !!groupId,
  });

  // Handle event click - navigate to content detail
  const handleEventClick = (event: CalendarEvent) => {
    navigate(`/group/${groupId}/content/${event.content_id}`);
  };

  if (!groupId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">No group selected</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700">
        <div className="w-full px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(`/group/${groupId}`)}
              className="flex items-center space-x-2 text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>

            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              <h1 className="text-lg font-semibold text-white">Calendar</h1>
            </div>

            <div className="w-16" /> {/* Spacer for balance */}
          </div>
        </div>
      </header>

      {/* Calendar Controls */}
      <div className="fixed top-14 left-0 right-0 z-40 bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3">
          {/* Date Navigation */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <h2 className="text-base sm:text-xl font-semibold text-white">
              {formatMonthYear(selectedDate)}
            </h2>

            <div className="flex items-center space-x-1">
              <button
                onClick={goToPrevious}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded"
              >
                Today
              </button>

              <button
                onClick={goToNext}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* View Selector */}
          <div className="flex items-center space-x-1 sm:space-x-2 bg-gray-700 rounded-lg p-1 w-full sm:w-auto">
            {(['month', 'week', 'day', 'year'] as CalendarView[]).map((viewType) => (
              <button
                key={viewType}
                onClick={() => setView(viewType)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded capitalize flex-1 sm:flex-none ${
                  view === viewType
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-600'
                }`}
              >
                {viewType}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="pt-32 px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">Loading calendar...</div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            {view === 'month' && (
              <MonthView
                events={events}
                selectedDate={selectedDate}
                currentMonth={currentMonth}
                onDateSelect={selectDate}
                onEventClick={handleEventClick}
              />
            )}

            {view === 'week' && (
              <WeekView
                events={events}
                selectedDate={selectedDate}
                currentWeek={currentWeek}
                onDateSelect={selectDate}
                onEventClick={handleEventClick}
              />
            )}

            {view === 'day' && (
              <DayView
                events={events}
                selectedDate={selectedDate}
                onDateSelect={selectDate}
                onEventClick={handleEventClick}
              />
            )}

            {view === 'year' && (
              <YearView
                events={events}
                selectedDate={selectedDate}
                currentYear={currentYear}
                onDateSelect={selectDate}
                onEventClick={handleEventClick}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
