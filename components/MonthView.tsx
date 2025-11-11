/**
 * Month View Component
 *
 * Displays a monthly calendar grid with events.
 * Based on the Tailwind UI calendar template with dynamic data.
 */

import React from 'react';
import { CalendarEvent } from '../types/CalendarTypes';
import { buildCalendarDays } from '../utils/calendarUtils';

interface MonthViewProps {
  events: CalendarEvent[];
  selectedDate: Date;
  currentMonth: Date;
  onDateSelect: (date: Date) => void;
}

/**
 * Month calendar grid view
 */
export const MonthView: React.FC<MonthViewProps> = ({
  events,
  selectedDate,
  currentMonth,
  onDateSelect,
}) => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Build calendar days with events
  const days = buildCalendarDays(year, month, events, selectedDate);

  return (
    <div>
      {/* Calendar Grid */}
      <div className="shadow ring-1 ring-black ring-opacity-5 bg-gray-800 rounded-lg">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-px border-b border-gray-700 bg-gray-900 text-center text-xs font-semibold leading-6 text-gray-400">
          <div className="py-2">M</div>
          <div className="py-2">T</div>
          <div className="py-2">W</div>
          <div className="py-2">T</div>
          <div className="py-2">F</div>
          <div className="py-2">S</div>
          <div className="py-2">S</div>
        </div>

        {/* Calendar Grid - Using data attributes with Tailwind modifiers */}
        <div className="isolate mt-2 grid grid-cols-7 gap-px rounded-lg bg-white/15 text-sm ring-1 ring-white/15">
          {days.map((day, dayIdx) => (
            <button
              key={dayIdx}
              type="button"
              onClick={() => onDateSelect(day.date)}
              data-is-current-month={day.isCurrentMonth ? '' : undefined}
              data-is-selected={day.isSelected ? '' : undefined}
              data-is-today={day.isToday ? '' : undefined}
              className="py-1.5 not-data-is-current-month:bg-gray-900/75 not-data-is-selected:not-data-is-current-month:not-data-is-today:text-gray-500 first:rounded-tl-lg last:rounded-br-lg hover:bg-gray-900/25 focus:z-10 data-is-current-month:bg-gray-900/90 not-data-is-selected:data-is-current-month:not-data-is-today:text-white data-is-current-month:hover:bg-gray-900/50 data-is-selected:font-semibold data-is-selected:text-gray-900 data-is-today:font-semibold data-is-today:not-data-is-selected:text-indigo-400 nth-36:rounded-bl-lg nth-7:rounded-tr-lg"
            >
              <time
                dateTime={day.date.toISOString()}
                className="mx-auto flex size-7 items-center justify-center rounded-full in-data-is-selected:not-in-data-is-today:bg-white in-data-is-selected:in-data-is-today:bg-indigo-500"
              >
                {day.date.getDate()}
              </time>

              {/* Event dots */}
              {day.events.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 justify-center">
                  {day.events.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: event.color || '#3B82F6' }}
                      title={event.title}
                    />
                  ))}
                  {day.events.length > 3 && (
                    <div className="text-[10px] text-gray-500">
                      +{day.events.length - 3}
                    </div>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Day Events List */}
      {days.find((d) => d.isSelected)?.events.length! > 0 && (
        <div className="mt-6 px-4 py-4 bg-gray-800 rounded-lg">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Events on{' '}
            {selectedDate.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </h2>
          <ol className="space-y-2">
            {days
              .find((d) => d.isSelected)
              ?.events.map((event) => (
                <li
                  key={event.id}
                  className="group flex items-center space-x-3 rounded-lg bg-gray-700 px-3 py-2 hover:bg-gray-600 transition-colors"
                >
                  <div
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.color || '#3B82F6' }}
                  />
                  <div className="flex-auto">
                    <p className="text-sm font-medium text-gray-200">
                      {event.title}
                    </p>
                    {event.time && (
                      <p className="text-xs text-gray-400">{event.time}</p>
                    )}
                  </div>
                  {event.tags && event.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {event.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: tag.color ? `${tag.color}20` : '#3B82F620',
                            color: tag.color || '#3B82F6',
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
          </ol>
        </div>
      )}
    </div>
  );
};
