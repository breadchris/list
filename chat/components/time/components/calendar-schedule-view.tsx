"use client";

import { useEffect, useRef } from "react";
import type { TimeEvent } from "@/types/time";

interface CalendarScheduleViewProps {
  currentDate: Date;
  events: TimeEvent[];
  onEventClick: (event: TimeEvent) => void;
}

export function CalendarScheduleView({
  currentDate,
  events,
  onEventClick,
}: CalendarScheduleViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  // Get events for the next 30 days
  const getUpcomingEvents = () => {
    const startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);

    return events
      .filter((event) => {
        const eventDate = new Date(event.start_time);
        return eventDate >= startDate && eventDate < endDate;
      })
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
  };

  const upcomingEvents = getUpcomingEvents();

  // Group events by date
  const eventsByDate = upcomingEvents.reduce((acc, event) => {
    const dateKey = new Date(event.start_time).toDateString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, TimeEvent[]>);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatTimeRange = (start: Date, end: Date) => {
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isPastEvent = (event: TimeEvent) => {
    const now = new Date();
    return new Date(event.end_time) < now;
  };

  useEffect(() => {
    // Scroll to today's events
    if (todayRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const todayElement = todayRef.current;
      const scrollPosition = todayElement.offsetTop - 20;
      container.scrollTop = scrollPosition;
    }
  }, []);

  return (
    <div ref={scrollContainerRef} className="overflow-y-auto h-full">
      {Object.keys(eventsByDate).length === 0 ? (
        <div className="border border-neutral-700 rounded-lg p-8 text-center text-neutral-500">
          No upcoming events in the next 30 days
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(eventsByDate).map(([dateKey, dayEvents]) => {
            const date = new Date(dateKey);
            const isTodayDate = isToday(date);

            return (
              <div
                key={dateKey}
                ref={isTodayDate ? todayRef : null}
                className={`${
                  isTodayDate ? "bg-neutral-800/50" : "bg-neutral-900"
                } p-4 border border-neutral-700 rounded-lg`}
              >
                <div className="flex items-baseline gap-4 mb-4">
                  <div className="flex flex-col items-center min-w-[3rem]">
                    <div className="text-xs text-neutral-500 uppercase">
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div
                      className={`mt-1 text-lg font-medium ${
                        isTodayDate
                          ? "w-10 h-10 md:w-12 md:h-12 rounded-full bg-sky-500 text-white flex items-center justify-center"
                          : "text-neutral-200"
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  </div>
                  <div className="flex-1 border-t border-neutral-700 mt-4"></div>
                </div>

                <div className="space-y-3 ml-0 md:ml-14">
                  {dayEvents.map((event) => {
                    const past = isPastEvent(event);

                    return (
                      <div
                        key={event.id}
                        className={`p-4 bg-neutral-800 border border-neutral-600 rounded-lg hover:border-neutral-400 transition-colors cursor-pointer ${
                          past ? "opacity-60" : ""
                        }`}
                        style={{
                          borderLeftWidth: "4px",
                          borderLeftColor: event.user_color || "#3b82f6",
                        }}
                        onClick={() => onEventClick(event)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-neutral-200 font-medium mb-1 truncate">
                              {event.title}
                            </div>
                            <div className="text-sm text-neutral-400">
                              {formatTimeRange(
                                new Date(event.start_time),
                                new Date(event.end_time)
                              )}
                            </div>
                            {event.description && (
                              <div className="text-sm text-neutral-500 mt-2 line-clamp-2">
                                {event.description}
                              </div>
                            )}
                          </div>
                          {event.user_name && (
                            <div className="flex-shrink-0">
                              <div
                                className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-neutral-600 flex items-center justify-center text-xs md:text-sm text-white"
                                style={{
                                  backgroundColor: event.user_color || "#3b82f6",
                                }}
                              >
                                {event.user_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
