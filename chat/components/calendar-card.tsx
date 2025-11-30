"use client";

import { memo, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar as CalendarIcon, MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { DeepPartial } from "ai";
import { CalendarEvent, CalendarEvents } from "@/lib/schema";
import { Calendar } from "@/components/ui/calendar";

export const CalendarCard = memo(function CalendarCard({
  events,
}: {
  events: DeepPartial<CalendarEvents> | undefined;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Parse dates from events and create a map for quick lookup
  const eventDates = useMemo(() => {
    if (!events) return new Map<string, DeepPartial<CalendarEvent>[]>();

    const dateMap = new Map<string, DeepPartial<CalendarEvent>[]>();
    events.forEach((event) => {
      if (event?.date) {
        const existing = dateMap.get(event.date) || [];
        dateMap.set(event.date, [...existing, event]);
      }
    });
    return dateMap;
  }, [events]);

  // Get dates that have events for highlighting
  const highlightedDates = useMemo(() => {
    return Array.from(eventDates.keys()).map((dateStr) => new Date(dateStr + "T00:00:00"));
  }, [eventDates]);

  // Get events for the selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return null;
    const dateStr = selectedDate.toISOString().split("T")[0];
    return eventDates.get(dateStr) || null;
  }, [selectedDate, eventDates]);

  // Format time range for display
  const formatTimeRange = (event: DeepPartial<CalendarEvent>) => {
    if (!event.start_time && !event.end_time) return null;
    if (event.start_time && event.end_time) {
      return `${event.start_time} - ${event.end_time}`;
    }
    return event.start_time || event.end_time;
  };

  return (
    <div className="w-full">
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="w-full border shadow-lg bg-neutral-800 border-neutral-700 transition-colors duration-200">
          <CardHeader className="border-b bg-neutral-800 border-neutral-700 transition-colors duration-200">
            <div className="flex items-center space-x-3">
              <CalendarIcon className="h-6 w-6 text-blue-400" />
              <CardTitle className="text-2xl font-bold text-neutral-100 transition-colors duration-200">
                Calendar Events
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Calendar */}
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  modifiers={{
                    hasEvent: highlightedDates,
                  }}
                  modifiersClassNames={{
                    hasEvent: "bg-blue-500/30 text-blue-300 font-semibold",
                  }}
                  className="rounded-md border border-neutral-700 bg-neutral-900"
                />
              </div>

              {/* Events List */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-neutral-100">
                  {selectedDateEvents
                    ? `Events on ${selectedDate?.toLocaleDateString()}`
                    : "All Events"}
                </h3>

                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {(selectedDateEvents || events || []).map((event, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-neutral-700/50 border border-neutral-600"
                    >
                      <div className="font-medium text-neutral-100">
                        {event?.title || "Untitled Event"}
                      </div>

                      {!selectedDateEvents && event?.date && (
                        <div className="text-sm text-neutral-400 mt-1">
                          {new Date(event.date + "T00:00:00").toLocaleDateString()}
                        </div>
                      )}

                      {formatTimeRange(event as DeepPartial<CalendarEvent>) && (
                        <div className="flex items-center gap-1 text-sm text-neutral-400 mt-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeRange(event as DeepPartial<CalendarEvent>)}
                        </div>
                      )}

                      {event?.location && (
                        <div className="flex items-center gap-1 text-sm text-neutral-400 mt-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </div>
                      )}

                      {event?.description && (
                        <p className="text-sm text-neutral-300 mt-2">
                          {event.description}
                        </p>
                      )}
                    </div>
                  ))}

                  {(!events || events.length === 0) && (
                    <p className="text-neutral-400 text-sm">
                      No events generated yet...
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
});
