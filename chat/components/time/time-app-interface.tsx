"use client";

import { useState, useEffect } from "react";
import { Plus, Link2 } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import { CalendarHeader } from "./components/calendar-header";
import { CalendarMonthView } from "./components/calendar-month-view";
import { CalendarWeekView } from "./components/calendar-week-view";
import { CalendarDayView } from "./components/calendar-day-view";
import { CalendarScheduleView } from "./components/calendar-schedule-view";
import { EventModal } from "./components/event-modal";
import { useTimeEvents } from "@/hooks/time/use-time-events";
import { useTimeRoomQuery } from "@/hooks/time/use-time-room-queries";
import type { TimeViewType, TimeEvent } from "@/types/time";
import { supabase } from "@/lib/list/SupabaseClient";

interface TimeAppInterfaceProps {
  calendarId: string;
  guestMode?: "view" | "contribute";
}

export function TimeAppInterface({
  calendarId,
  guestMode,
}: TimeAppInterfaceProps) {
  const { data: calendar } = useTimeRoomQuery(calendarId);
  const { events, createEvent, updateEvent, deleteEvent } = useTimeEvents();

  const [view, setView] = useState<TimeViewType>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimeEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [userId, setUserId] = useState<string>("anonymous");
  const [userName, setUserName] = useState<string | undefined>();
  const [copySuccess, setCopySuccess] = useState(false);

  // Get current user
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    fetchUser();

    const storedUsername = localStorage.getItem("chat-username");
    if (storedUsername) {
      setUserName(storedUsername);
    }
  }, []);

  // Guest access flags
  const isGuest = !!guestMode;
  const canEditEvents = !isGuest || guestMode === "contribute";

  // Navigation handlers
  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Event handlers
  const handleCreateEvent = (date?: Date) => {
    if (!canEditEvents) return;
    setSelectedEvent(null);
    setSelectedDate(date || null);
    setIsModalOpen(true);
  };

  const handleEditEvent = (event: TimeEvent) => {
    if (!canEditEvents) return;
    setSelectedEvent(event);
    setSelectedDate(null);
    setIsModalOpen(true);
  };

  const handleSaveEvent = (
    eventData: Omit<TimeEvent, "id" | "created_at" | "updated_at" | "user_color">
  ) => {
    if (selectedEvent) {
      // Update existing event
      updateEvent(selectedEvent.id, eventData);
    } else {
      // Create new event
      createEvent(eventData);
    }
    setIsModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEvent(eventId);
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleEventResize = (eventId: string, startTime: string, endTime: string) => {
    updateEvent(eventId, { start_time: startTime, end_time: endTime });
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/time/${calendarId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const calendarName =
    calendar?.metadata?.title || calendar?.data || "Calendar";

  // Swipe handlers for mobile navigation (disabled in week view)
  const swipeHandlers = useSwipeable({
    onSwipedLeft: view !== "week" ? handleNext : undefined,
    onSwipedRight: view !== "week" ? handlePrevious : undefined,
    trackMouse: false,
    trackTouch: true,
    delta: 50,
    preventScrollOnSwipe: false,
  });

  return (
    <div
      className={`h-full flex flex-col bg-neutral-950 ${isGuest ? "pt-10" : ""}`}
    >
      {/* Header with calendar info */}
      <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-neutral-800 bg-neutral-900">
        <h1 className="text-neutral-200 font-medium truncate">{calendarName}</h1>
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
          title="Copy link"
        >
          {copySuccess ? (
            <span className="text-green-400">Copied!</span>
          ) : (
            <>
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </>
          )}
        </button>
      </div>

      {/* Calendar header */}
      <CalendarHeader
        view={view}
        onViewChange={setView}
        currentDate={currentDate}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
      />

      {/* Calendar views with swipe navigation */}
      <div {...swipeHandlers} className="flex-1 p-4 overflow-hidden">
        {view === "month" && (
          <CalendarMonthView
            currentDate={currentDate}
            events={events}
            onEventClick={handleEditEvent}
            onDateClick={handleCreateEvent}
          />
        )}
        {view === "week" && (
          <CalendarWeekView
            currentDate={currentDate}
            events={events}
            onEventClick={handleEditEvent}
            onTimeSlotClick={handleCreateEvent}
            onEventResize={canEditEvents ? handleEventResize : undefined}
          />
        )}
        {view === "day" && (
          <CalendarDayView
            currentDate={currentDate}
            events={events}
            onEventClick={handleEditEvent}
            onTimeSlotClick={handleCreateEvent}
            onEventResize={canEditEvents ? handleEventResize : undefined}
          />
        )}
        {view === "schedule" && (
          <CalendarScheduleView
            currentDate={currentDate}
            events={events}
            onEventClick={handleEditEvent}
          />
        )}
      </div>

      {/* Floating Action Button for creating events */}
      {canEditEvents && (
        <button
          onClick={() => handleCreateEvent()}
          className="fixed bottom-6 right-6 w-14 h-14 md:w-16 md:h-16 bg-sky-600 hover:bg-sky-500 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:shadow-xl"
          aria-label="Create new event"
        >
          <Plus className="w-6 h-6 md:w-8 md:h-8" />
        </button>
      )}

      {/* Event modal */}
      {isModalOpen && (
        <EventModal
          event={selectedEvent}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEvent(null);
            setSelectedDate(null);
          }}
          initialDate={selectedDate}
          userId={userId}
          userName={userName}
        />
      )}
    </div>
  );
}
