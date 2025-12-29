"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { TimeEvent } from "@/types/time";

const HOUR_HEIGHT = 64;
const SNAP_MINUTES = 15;
const SNAP_PIXELS = (SNAP_MINUTES / 60) * HOUR_HEIGHT; // 16px
const MIN_EVENT_HEIGHT = SNAP_PIXELS; // Minimum 15 minutes

interface ResizeState {
  eventId: string;
  edge: "top" | "bottom";
  startY: number;
  originalEvent: TimeEvent;
  previewTop: number;
  previewHeight: number;
  dayDate: Date;
}

interface CalendarWeekViewProps {
  currentDate: Date;
  events: TimeEvent[];
  onEventClick: (event: TimeEvent) => void;
  onTimeSlotClick: (date: Date) => void;
  onEventResize?: (eventId: string, startTime: string, endTime: string) => void;
}

export function CalendarWeekView({
  currentDate,
  events,
  onEventClick,
  onTimeSlotClick,
  onEventResize,
}: CalendarWeekViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const [resizing, setResizing] = useState<ResizeState | null>(null);

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      return date;
    });
  };

  const weekDays = getWeekDays();

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start_time);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getEventPosition = (event: TimeEvent) => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const duration = (end.getTime() - start.getTime()) / (1000 * 60);

    return {
      top: (startMinutes / 60) * HOUR_HEIGHT,
      height: (duration / 60) * HOUR_HEIGHT,
    };
  };

  // Snap pixels to 15-minute grid
  const snapToGrid = useCallback((pixels: number): number => {
    return Math.round(pixels / SNAP_PIXELS) * SNAP_PIXELS;
  }, []);

  // Convert pixel position to time
  const pixelsToTime = useCallback((pixels: number, baseDate: Date): Date => {
    const minutes = (pixels / HOUR_HEIGHT) * 60;
    const snappedMinutes = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
    const clampedMinutes = Math.max(0, Math.min(snappedMinutes, 24 * 60 - SNAP_MINUTES));
    const result = new Date(baseDate);
    result.setHours(Math.floor(clampedMinutes / 60), clampedMinutes % 60, 0, 0);
    return result;
  }, []);

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.PointerEvent, event: TimeEvent, edge: "top" | "bottom", dayDate: Date) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const position = getEventPosition(event);
      setResizing({
        eventId: event.id,
        edge,
        startY: e.clientY,
        originalEvent: event,
        previewTop: position.top,
        previewHeight: Math.max(position.height, MIN_EVENT_HEIGHT),
        dayDate,
      });
    },
    []
  );

  // Handle resize move
  const handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizing) return;

      const deltaY = e.clientY - resizing.startY;
      const originalPosition = getEventPosition(resizing.originalEvent);

      if (resizing.edge === "bottom") {
        // Dragging bottom edge - change end time
        const newHeight = snapToGrid(originalPosition.height + deltaY);
        const clampedHeight = Math.max(MIN_EVENT_HEIGHT, newHeight);
        // Don't let event extend past midnight
        const maxHeight = 24 * HOUR_HEIGHT - originalPosition.top;
        setResizing({
          ...resizing,
          previewHeight: Math.min(clampedHeight, maxHeight),
        });
      } else {
        // Dragging top edge - change start time
        const newTop = snapToGrid(originalPosition.top + deltaY);
        const clampedTop = Math.max(0, newTop);
        // Adjust height to maintain end time position
        const bottomEdge = originalPosition.top + originalPosition.height;
        const newHeight = bottomEdge - clampedTop;
        if (newHeight >= MIN_EVENT_HEIGHT) {
          setResizing({
            ...resizing,
            previewTop: clampedTop,
            previewHeight: newHeight,
          });
        }
      }
    },
    [resizing, snapToGrid]
  );

  // Handle resize end
  const handleResizeEnd = useCallback(
    (e: React.PointerEvent) => {
      if (!resizing || !onEventResize) {
        setResizing(null);
        return;
      }

      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      const newStartTime = pixelsToTime(resizing.previewTop, resizing.dayDate);
      const newEndTime = pixelsToTime(
        resizing.previewTop + resizing.previewHeight,
        resizing.dayDate
      );

      onEventResize(
        resizing.eventId,
        newStartTime.toISOString(),
        newEndTime.toISOString()
      );
      setResizing(null);
    },
    [resizing, onEventResize, pixelsToTime]
  );

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();

      // Calculate position in pixels (64px per hour)
      const hourPosition = currentHour * 64;
      const minuteOffset = (currentMinutes / 60) * 64;
      const totalPosition = hourPosition + minuteOffset;

      // Center the current time in the viewport
      const containerHeight = scrollContainerRef.current.clientHeight;
      const scrollPosition = totalPosition - containerHeight / 2;

      scrollContainerRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      className="border border-neutral-700 rounded-lg overflow-auto h-full"
    >
      <div className="min-w-[640px] md:min-w-0">
        {/* Header row */}
        <div className="grid grid-cols-[50px_repeat(7,1fr)] md:grid-cols-[60px_repeat(7,1fr)] border-b border-neutral-700 sticky top-0 bg-neutral-900 z-10">
          <div className="border-r border-neutral-700"></div>
          {weekDays.map((day, index) => (
            <div
              key={index}
              className={`p-2 md:p-4 text-center border-r border-neutral-700 last:border-r-0 ${
                isToday(day) ? "bg-neutral-800" : ""
              }`}
            >
              <div className="text-neutral-500 text-xs md:text-sm">
                <span className="hidden sm:inline">
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className="sm:hidden">
                  {day.toLocaleDateString("en-US", { weekday: "narrow" })}
                </span>
              </div>
              <div
                className={`mt-1 text-sm md:text-base ${
                  isToday(day)
                    ? "w-6 h-6 md:w-8 md:h-8 rounded-full bg-sky-500 text-white flex items-center justify-center mx-auto"
                    : "text-neutral-200"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="grid grid-cols-[50px_repeat(7,1fr)] md:grid-cols-[60px_repeat(7,1fr)]">
          {/* Hour labels */}
          <div className="border-r border-neutral-700">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-16 border-b border-neutral-800 px-1 md:px-2 py-1 text-xs text-neutral-500 text-right"
              >
                <span className="hidden sm:inline">
                  {hour === 0
                    ? "12 AM"
                    : hour < 12
                    ? `${hour} AM`
                    : hour === 12
                    ? "12 PM"
                    : `${hour - 12} PM`}
                </span>
                <span className="sm:hidden">
                  {hour === 0
                    ? "12a"
                    : hour < 12
                    ? `${hour}a`
                    : hour === 12
                    ? "12p"
                    : `${hour - 12}p`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(day);

            return (
              <div
                key={dayIndex}
                className="border-r border-neutral-700 last:border-r-0 relative"
                onPointerMove={resizing ? handleResizeMove : undefined}
                onPointerUp={resizing ? handleResizeEnd : undefined}
                onPointerCancel={resizing ? handleResizeEnd : undefined}
              >
                {/* Hour slots */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="h-16 border-b border-neutral-800 cursor-pointer hover:bg-neutral-800/50 transition-colors"
                    onClick={() => {
                      const date = new Date(day);
                      date.setHours(hour, 0, 0, 0);
                      onTimeSlotClick(date);
                    }}
                  ></div>
                ))}

                {/* Events */}
                {dayEvents.map((event) => {
                  const position = getEventPosition(event);
                  const isResizingThis = resizing?.eventId === event.id;
                  const displayTop = isResizingThis ? resizing.previewTop : position.top;
                  const displayHeight = isResizingThis
                    ? resizing.previewHeight
                    : Math.max(position.height, MIN_EVENT_HEIGHT);

                  return (
                    <div
                      key={event.id}
                      className={`absolute left-0.5 right-0.5 md:left-1 md:right-1 bg-neutral-800 border border-neutral-600 rounded cursor-pointer hover:border-neutral-400 transition-colors overflow-hidden group ${
                        isResizingThis ? "opacity-80 z-20" : ""
                      }`}
                      style={{
                        top: `${displayTop}px`,
                        height: `${displayHeight}px`,
                        borderLeftWidth: "3px",
                        borderLeftColor: event.user_color || "#3b82f6",
                      }}
                      onClick={(e) => {
                        if (resizing) return;
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                    >
                      {/* Top resize handle */}
                      {onEventResize && (
                        <div
                          className="absolute top-0 left-0 right-0 h-1.5 cursor-n-resize opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-opacity rounded-t"
                          onPointerDown={(e) => handleResizeStart(e, event, "top", day)}
                        />
                      )}

                      {/* Event content */}
                      <div className="px-1 md:px-2 py-1 h-full overflow-hidden">
                        <div className="text-xs text-neutral-200 truncate">
                          {event.title}
                        </div>
                        <div className="text-xs text-neutral-400 hidden sm:block">
                          {isResizingThis ? (
                            pixelsToTime(resizing.previewTop, day).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          ) : (
                            new Date(event.start_time).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          )}
                        </div>
                      </div>

                      {/* Bottom resize handle */}
                      {onEventResize && (
                        <div
                          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-s-resize opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-opacity rounded-b"
                          onPointerDown={(e) => handleResizeStart(e, event, "bottom", day)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
