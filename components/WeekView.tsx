/**
 * Week View Component
 *
 * Displays a week with 7 day columns and hourly time slots.
 * Adapted from Tailwind UI calendar week view template.
 */

import React from 'react';
import { CalendarEvent } from '../types/CalendarTypes';
import {
  buildWeekDays,
  getDayHours,
  formatHour,
  calculateTimeSlotRow,
  calculateDurationSpan,
  getShortDayName,
  isSameDay,
} from '../utils/calendarUtils';

interface WeekViewProps {
  events: CalendarEvent[];
  selectedDate: Date;
  currentWeek: Date;
  onDateSelect: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

/**
 * Week calendar view with 7-day grid and time slots
 */
export const WeekView: React.FC<WeekViewProps> = ({
  events,
  selectedDate,
  currentWeek,
  onDateSelect,
  onEventClick,
}) => {
  const hours = getDayHours();
  const weekDays = buildWeekDays(currentWeek, events, selectedDate);

  // Get all-day events for the week
  const allDayEventsByDay = weekDays.map(day => ({
    ...day,
    allDayEvents: day.events.filter(e => !e.time),
  }));

  // Get timed events for the week
  const timedEventsByDay = weekDays.map(day => ({
    ...day,
    timedEvents: day.events.filter(e => e.time),
  }));

  return (
    <div className="flex flex-col bg-gray-900 rounded-lg shadow ring-1 ring-white/5">
      {/* All-day events section */}
      {allDayEventsByDay.some(day => day.allDayEvents.length > 0) && (
        <div className="border-b border-gray-700 bg-gray-800">
          <div className="grid grid-cols-7 gap-px bg-gray-700">
            {allDayEventsByDay.map((day, dayIdx) => (
              <div key={dayIdx} className="bg-gray-800 px-2 py-2 min-h-[60px]">
                {day.allDayEvents.length > 0 && (
                  <div className="space-y-1">
                    {day.allDayEvents.slice(0, 2).map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick?.(event)}
                        className="w-full text-left rounded px-2 py-1 text-xs hover:bg-gray-700 transition-colors truncate"
                        style={{
                          backgroundColor: event.color ? `${event.color}20` : '#3B82F620',
                          color: event.color || '#3B82F6',
                        }}
                        title={event.title}
                      >
                        {event.title}
                      </button>
                    ))}
                    {day.allDayEvents.length > 2 && (
                      <p className="text-xs text-gray-500 px-2">
                        +{day.allDayEvents.length - 2} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week day headers */}
      <div className="sticky top-0 z-30 flex-none bg-gray-800 border-b border-gray-700">
        <div className="grid grid-cols-7 text-sm leading-6 text-gray-400">
          <div className="flex items-center justify-center py-3">
            <span className="sr-only">Sunday</span>
            <span>S</span>
          </div>
          <div className="flex items-center justify-center py-3">
            <span className="sr-only">Monday</span>
            <span>M</span>
          </div>
          <div className="flex items-center justify-center py-3">
            <span className="sr-only">Tuesday</span>
            <span>T</span>
          </div>
          <div className="flex items-center justify-center py-3">
            <span className="sr-only">Wednesday</span>
            <span>W</span>
          </div>
          <div className="flex items-center justify-center py-3">
            <span className="sr-only">Thursday</span>
            <span>T</span>
          </div>
          <div className="flex items-center justify-center py-3">
            <span className="sr-only">Friday</span>
            <span>F</span>
          </div>
          <div className="flex items-center justify-center py-3">
            <span className="sr-only">Saturday</span>
            <span>S</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px border-t border-gray-700 bg-gray-700 text-xs leading-6 text-gray-400">
          {weekDays.map((day, dayIdx) => (
            <button
              key={dayIdx}
              onClick={() => onDateSelect(day.date)}
              data-is-today={day.isToday ? '' : undefined}
              data-is-selected={day.isSelected ? '' : undefined}
              className="bg-gray-800 py-2 hover:bg-gray-700 transition-colors"
            >
              <time
                dateTime={day.date.toISOString()}
                className="mx-auto flex h-7 w-7 items-center justify-center rounded-full data-is-selected:bg-white data-is-selected:text-gray-900 data-is-today:not-data-is-selected:bg-indigo-500 data-is-today:not-data-is-selected:text-white"
              >
                {day.date.getDate()}
              </time>
            </button>
          ))}
        </div>
      </div>

      {/* Time grid */}
      <div className="flex flex-auto overflow-hidden bg-gray-900">
        <div className="flex flex-auto flex-col">
          <div className="flex w-full flex-auto">
            <div className="w-14 flex-none bg-gray-800 ring-1 ring-gray-700" />
            <div className="grid flex-auto grid-cols-1 grid-rows-1">
              {/* Vertical lines (day dividers) */}
              <div className="col-start-1 col-end-2 row-start-1 grid grid-cols-7 divide-x divide-gray-700">
                <div className="col-start-1 row-span-full" />
                <div className="col-start-2 row-span-full" />
                <div className="col-start-3 row-span-full" />
                <div className="col-start-4 row-span-full" />
                <div className="col-start-5 row-span-full" />
                <div className="col-start-6 row-span-full" />
                <div className="col-start-7 row-span-full" />
              </div>

              {/* Horizontal lines (hour dividers) */}
              <div
                className="col-start-1 col-end-2 row-start-1 grid divide-y divide-gray-700"
                style={{ gridTemplateRows: 'repeat(48, minmax(3.5rem, 1fr))' }}
              >
                <div className="row-end-1 h-7"></div>
                {hours.map((hour) => (
                  <React.Fragment key={hour}>
                    <div>
                      <div className="sticky left-0 z-20 -ml-14 -mt-2.5 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                        {formatHour(hour)}
                      </div>
                    </div>
                    <div />
                  </React.Fragment>
                ))}
              </div>

              {/* Events for each day */}
              <ol
                className="col-start-1 col-end-2 row-start-1 grid grid-cols-7"
                style={{
                  gridTemplateRows: '1.75rem repeat(288, minmax(0, 1fr)) auto',
                }}
              >
                {timedEventsByDay.map((day, dayIdx) =>
                  day.timedEvents.map((event) => {
                    const startRow = calculateTimeSlotRow(event.time || '00:00');
                    const span = event.end_time
                      ? calculateDurationSpan(event.time || '00:00', event.end_time)
                      : 12; // Default 1 hour

                    // Map dayOfWeek (0-6, Sunday=0) to col-start class (1-7)
                    const colStart = dayIdx + 1;

                    return (
                      <li
                        key={event.id}
                        className="relative mt-px flex"
                        style={{
                          gridRow: `${startRow} / span ${span}`,
                          gridColumnStart: colStart,
                        }}
                      >
                        <button
                          onClick={() => onEventClick?.(event)}
                          className="group absolute inset-1 flex flex-col overflow-y-auto rounded-lg p-2 text-xs leading-5 transition-all"
                          style={{
                            backgroundColor: event.color ? `${event.color}15` : '#3B82F615',
                          }}
                        >
                          <p
                            className="order-1 font-semibold truncate"
                            style={{ color: event.color || '#3B82F6' }}
                          >
                            {event.title}
                          </p>
                          <p
                            className="opacity-70"
                            style={{ color: event.color || '#3B82F6' }}
                          >
                            <time dateTime={event.date.toISOString()}>
                              {event.time}
                            </time>
                          </p>
                        </button>
                      </li>
                    );
                  })
                )}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
