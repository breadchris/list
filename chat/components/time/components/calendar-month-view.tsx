"use client";

import type { TimeEvent } from "@/types/time";

interface CalendarMonthViewProps {
  currentDate: Date;
  events: TimeEvent[];
  onEventClick: (event: TimeEvent) => void;
  onDateClick: (date: Date) => void;
}

export function CalendarMonthView({
  currentDate,
  events,
  onEventClick,
  onDateClick,
}: CalendarMonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month's days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      isCurrentMonth: false,
    });
  }

  // Current month's days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  // Next month's days
  const remainingDays = 42 - days.length; // 6 weeks * 7 days
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start_time);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="border border-neutral-700 rounded-lg overflow-hidden h-full flex flex-col">
      <div className="grid grid-cols-7 border-b border-neutral-700">
        {weekDays.map((day) => (
          <div
            key={day}
            className="p-2 md:p-4 text-center text-xs md:text-sm border-r border-neutral-700 last:border-r-0 bg-neutral-800 text-neutral-400"
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.slice(0, 1)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1">
        {days.map((day, index) => {
          const dayEvents = getEventsForDate(day.date);
          const today = isToday(day.date);

          return (
            <div
              key={index}
              className={`min-h-20 md:min-h-28 border-r border-b border-neutral-700 last:border-r-0 p-1 md:p-2 cursor-pointer hover:bg-neutral-800/50 transition-colors ${
                !day.isCurrentMonth ? "bg-neutral-900/50" : "bg-neutral-900"
              }`}
              onClick={() => onDateClick(day.date)}
            >
              <div
                className={`mb-1 md:mb-2 text-xs md:text-sm ${
                  today
                    ? "w-5 h-5 md:w-7 md:h-7 rounded-full bg-sky-500 text-white flex items-center justify-center"
                    : day.isCurrentMonth
                    ? "text-neutral-200"
                    : "text-neutral-600"
                }`}
              >
                {day.date.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((event) => (
                  <div
                    key={event.id}
                    className="px-1 md:px-2 py-0.5 md:py-1 bg-neutral-800 border border-neutral-600 rounded text-xs cursor-pointer hover:border-neutral-400 transition-colors overflow-hidden"
                    style={{
                      borderLeftWidth: "3px",
                      borderLeftColor: event.user_color || "#3b82f6",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    <div className="truncate text-neutral-200">{event.title}</div>
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-neutral-500 px-1 md:px-2">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
