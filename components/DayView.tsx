/**
 * Day View Component
 *
 * Displays a single day with hourly time slots and positioned events.
 * Adapted from Tailwind UI calendar day view template.
 */

import React from 'react';
import { CalendarEvent } from '../types/CalendarTypes';
import {
  getDayHours,
  formatHour,
  calculateTimeSlotRow,
  calculateDurationSpan,
  formatShortDate,
  isSameDay,
  isToday as checkIsToday
} from '../utils/calendarUtils';

interface DayViewProps {
  events: CalendarEvent[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

/**
 * Day calendar view with hourly time slots
 */
export const DayView: React.FC<DayViewProps> = ({
  events,
  selectedDate,
  onDateSelect,
  onEventClick,
}) => {
  const hours = getDayHours();
  const isToday = checkIsToday(selectedDate);

  // Separate all-day events (no time) from timed events
  const allDayEvents = events.filter(event => !event.time);
  const timedEvents = events.filter(event => event.time);

  return (
    <div className="flex flex-col bg-gray-900 rounded-lg shadow ring-1 ring-white/5">
      {/* All-day events section */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-gray-700 bg-gray-800 px-4 py-2">
          <p className="text-xs font-semibold text-gray-400 mb-2">All-day</p>
          <div className="space-y-1">
            {allDayEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onEventClick?.(event)}
                className="w-full text-left rounded px-2 py-1 text-xs hover:bg-gray-700 transition-colors"
                style={{
                  backgroundColor: event.color ? `${event.color}20` : '#3B82F620',
                  color: event.color || '#3B82F6',
                }}
              >
                {event.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day header */}
      <div className="sticky top-0 z-30 flex-none bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-center py-3">
          <button
            onClick={() => onDateSelect(selectedDate)}
            className="flex items-center space-x-2 hover:text-white transition-colors"
          >
            <time
              dateTime={selectedDate.toISOString()}
              data-is-today={isToday ? '' : undefined}
              className="text-sm font-semibold text-gray-300 data-is-today:text-indigo-400"
            >
              {formatShortDate(selectedDate)}
            </time>
          </button>
        </div>
      </div>

      {/* Time grid */}
      <div className="flex flex-auto overflow-hidden bg-gray-900">
        <div className="flex flex-auto flex-col">
          <div className="flex w-full flex-auto">
            <div className="w-14 flex-none bg-gray-800 ring-1 ring-gray-700" />
            <div className="grid flex-auto grid-cols-1 grid-rows-1">
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

              {/* Events */}
              <ol
                className="col-start-1 col-end-2 row-start-1 grid grid-cols-1"
                style={{
                  gridTemplateRows: '1.75rem repeat(288, minmax(0, 1fr)) auto',
                }}
              >
                {timedEvents.map((event) => {
                  const startRow = calculateTimeSlotRow(event.time || '00:00');
                  const span = event.end_time
                    ? calculateDurationSpan(event.time || '00:00', event.end_time)
                    : 12; // Default 1 hour

                  return (
                    <li
                      key={event.id}
                      className="relative mt-px flex"
                      style={{ gridRow: `${startRow} / span ${span}` }}
                    >
                      <button
                        onClick={() => onEventClick?.(event)}
                        className="group absolute inset-1 flex flex-col overflow-y-auto rounded-lg p-2 text-xs leading-5 transition-all"
                        style={{
                          backgroundColor: event.color ? `${event.color}15` : '#3B82F615',
                        }}
                      >
                        <p
                          className="order-1 font-semibold"
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
                            {event.end_time && ` - ${event.end_time}`}
                          </time>
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
