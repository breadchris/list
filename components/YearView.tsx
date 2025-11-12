/**
 * Year View Component
 *
 * Displays 12 mini-month calendars in a responsive grid.
 * Adapted from Tailwind UI calendar year view template.
 */

import React from 'react';
import { CalendarEvent } from '../types/CalendarTypes';
import { buildYearMonths } from '../utils/calendarUtils';

interface YearViewProps {
  events: CalendarEvent[];
  selectedDate: Date;
  currentYear: number;
  onDateSelect: (date: Date) => void;
  onMonthSelect?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

/**
 * Year calendar view with 12 month grids
 */
export const YearView: React.FC<YearViewProps> = ({
  events,
  selectedDate,
  currentYear,
  onDateSelect,
  onMonthSelect,
}) => {
  const yearMonths = buildYearMonths(currentYear, events, selectedDate);

  return (
    <div className="bg-gray-900">
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-x-8 gap-y-16 px-4 py-16 sm:grid-cols-2 sm:px-6 xl:max-w-none xl:grid-cols-3 xl:px-8 2xl:grid-cols-4">
        {yearMonths.map((monthData) => (
          <section key={monthData.month} className="text-center">
            {/* Month header */}
            <h2 className="text-sm font-semibold text-white">
              {monthData.name}
            </h2>

            {/* Day headers */}
            <div className="mt-6 grid grid-cols-7 text-xs leading-6 text-gray-400">
              <div>S</div>
              <div>M</div>
              <div>T</div>
              <div>W</div>
              <div>T</div>
              <div>F</div>
              <div>S</div>
            </div>

            {/* Month grid */}
            <div className="isolate mt-2 grid grid-cols-7 gap-px rounded-lg bg-white/10 text-sm ring-1 ring-white/10">
              {monthData.days.map((day, dayIdx) => (
                <button
                  key={dayIdx}
                  type="button"
                  onClick={() => onDateSelect(day.date)}
                  data-is-current-month={day.isCurrentMonth ? '' : undefined}
                  data-is-selected={day.isSelected ? '' : undefined}
                  data-is-today={day.isToday ? '' : undefined}
                  className="py-1.5 not-data-is-current-month:bg-gray-900/75 not-data-is-selected:not-data-is-current-month:not-data-is-today:text-gray-500 first:rounded-tl-lg last:rounded-br-lg hover:bg-gray-900/25 focus:z-10 data-is-current-month:bg-gray-900/90 not-data-is-selected:data-is-current-month:not-data-is-today:text-white data-is-current-month:hover:bg-gray-900/50 data-is-selected:font-semibold data-is-selected:text-gray-900 data-is-today:font-semibold data-is-today:not-data-is-selected:text-indigo-400"
                >
                  <time
                    dateTime={day.date.toISOString()}
                    className="mx-auto flex size-7 items-center justify-center rounded-full in-data-is-selected:not-in-data-is-today:bg-white in-data-is-selected:in-data-is-today:bg-indigo-500"
                  >
                    {day.date.getDate()}
                  </time>

                  {/* Event indicator dots */}
                  {day.hasEvents && (
                    <div className="mx-auto mt-1 flex justify-center gap-0.5">
                      {day.eventCount > 3 ? (
                        <>
                          <div className="h-1 w-1 rounded-full bg-blue-400" />
                          <div className="h-1 w-1 rounded-full bg-blue-400" />
                          <div className="h-1 w-1 rounded-full bg-blue-400" />
                        </>
                      ) : (
                        Array.from({ length: day.eventCount }).map((_, i) => (
                          <div key={i} className="h-1 w-1 rounded-full bg-blue-400" />
                        ))
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
