"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Calendar as CalendarIcon, MapPin, Clock, Check, X } from "lucide-react";
import { useArray, useYDoc } from "@y-sweet/react";
import { experimental_useObject as useObject } from "ai/react";
import { useUsername } from "./username-prompt";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calendarSchemaObject, type CalendarEvent } from "@/lib/schema";

interface Message {
  id: string;
  username: string;
  timestamp: string;
  content: string;
  pending_events?: CalendarEvent[];
}

interface StoredEvent extends CalendarEvent {
  id: string;
  added_at: string;
}

export function CalendarChatInterface() {
  const doc = useYDoc();
  const messages = useArray<Message>("calendarMessages");
  const events = useArray<StoredEvent>("calendarEvents");

  return (
    <CalendarChatInner
      messages={messages}
      events={events}
      doc={doc}
    />
  );
}

interface CalendarChatInnerProps {
  messages: {
    push: (items: Message[]) => void;
    toArray: () => Message[];
    delete: (index: number, length: number) => void;
    insert: (index: number, items: Message[]) => void;
  };
  events: {
    push: (items: StoredEvent[]) => void;
    toArray: () => StoredEvent[];
    delete: (index: number, length: number) => void;
  };
  doc: import("yjs").Doc;
}

function CalendarChatInner({
  messages,
  events,
  doc,
}: CalendarChatInnerProps) {
  const username = useUsername();
  const [inputValue, setInputValue] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialRender = useRef(true);
  const prevLoadingRef = useRef(false);

  // Use the useObject hook for proper streaming parsing
  const {
    object: generatedObject,
    submit: submitGeneration,
    isLoading,
  } = useObject({
    api: "/api/object",
    schema: calendarSchemaObject,
  });

  // Auto-scroll to bottom when new messages arrive
  const messageCount = messages.toArray().length;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: isInitialRender.current ? "instant" : "smooth",
    });
    isInitialRender.current = false;
  }, [messageCount]);

  const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  };

  // Handle when generation completes - detect loading transition from true to false
  useEffect(() => {
    const justFinished = prevLoadingRef.current === true && isLoading === false;
    prevLoadingRef.current = isLoading;

    // Only process when loading just finished and we have a pending prompt
    if (!justFinished || !pendingPrompt) return;

    console.log("Generation complete, object:", generatedObject);

    const parsedEvents = generatedObject?.events as CalendarEvent[] | undefined;

    if (parsedEvents && parsedEvents.length > 0) {
      // Add assistant message with pending events
      const assistantMessage: Message = {
        id: generateId(),
        username: "Calendar",
        timestamp: getCurrentTime(),
        content: `I found ${parsedEvents.length} event${parsedEvents.length > 1 ? "s" : ""} in your message. Would you like to add ${parsedEvents.length > 1 ? "them" : "it"} to your calendar?`,
        pending_events: parsedEvents,
      };
      messages.push([assistantMessage]);
    } else {
      // No events found
      const assistantMessage: Message = {
        id: generateId(),
        username: "Calendar",
        timestamp: getCurrentTime(),
        content: "I couldn't find any calendar events in your message. Try describing your plans with dates and times.",
      };
      messages.push([assistantMessage]);
    }

    setPendingPrompt(null);
  }, [generatedObject, isLoading, pendingPrompt, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const effectiveUsername = username || "anonymous";
    const userMessage: Message = {
      id: generateId(),
      username: effectiveUsername,
      timestamp: getCurrentTime(),
      content: inputValue.trim(),
    };

    messages.push([userMessage]);
    setPendingPrompt(inputValue.trim());

    // Submit with bot_id for calendar schema
    submitGeneration({
      prompt: inputValue.trim(),
      bot_id: "calendar",
    });

    setInputValue("");
  };

  const handleAddEvents = useCallback(
    (messageId: string, eventsToAdd: CalendarEvent[]) => {
      doc.transact(() => {
        // Add events to the calendar
        const storedEvents: StoredEvent[] = eventsToAdd.map((event) => ({
          ...event,
          id: generateId(),
          added_at: new Date().toISOString(),
        }));
        events.push(storedEvents);

        // Update message to remove pending events
        const msgArray = messages.toArray();
        const msgIndex = msgArray.findIndex((m) => m.id === messageId);
        if (msgIndex !== -1) {
          const msg = msgArray[msgIndex];
          const updatedMsg: Message = {
            ...msg,
            content: `Added ${eventsToAdd.length} event${eventsToAdd.length > 1 ? "s" : ""} to your calendar.`,
            pending_events: undefined,
          };
          messages.delete(msgIndex, 1);
          messages.insert(msgIndex, [updatedMsg]);
        }
      });
    },
    [doc, events, messages]
  );

  const handleDeclineEvents = useCallback(
    (messageId: string) => {
      const msgArray = messages.toArray();
      const msgIndex = msgArray.findIndex((m) => m.id === messageId);
      if (msgIndex !== -1) {
        const msg = msgArray[msgIndex];
        const updatedMsg: Message = {
          ...msg,
          content: "No events added.",
          pending_events: undefined,
        };
        messages.delete(msgIndex, 1);
        messages.insert(msgIndex, [updatedMsg]);
      }
    },
    [messages]
  );

  const handleRemoveEvent = useCallback(
    (eventId: string) => {
      const eventArray = events.toArray();
      const eventIndex = eventArray.findIndex((e) => e.id === eventId);
      if (eventIndex !== -1) {
        events.delete(eventIndex, 1);
      }
    },
    [events]
  );

  // Compute highlighted dates from events
  const eventsArray = events.toArray();
  const eventDates = useMemo(() => {
    const dateMap = new Map<string, StoredEvent[]>();
    eventsArray.forEach((event) => {
      if (event.date) {
        const existing = dateMap.get(event.date) || [];
        dateMap.set(event.date, [...existing, event]);
      }
    });
    return dateMap;
  }, [eventsArray]);

  const highlightedDates = useMemo(() => {
    return Array.from(eventDates.keys()).map(
      (dateStr) => new Date(dateStr + "T00:00:00")
    );
  }, [eventDates]);

  // Get events for selected date or all events
  const displayedEvents = useMemo(() => {
    if (!selectedDate) {
      return events.toArray();
    }
    const dateStr = selectedDate.toISOString().split("T")[0];
    return eventDates.get(dateStr) || [];
  }, [selectedDate, eventDates, events]);

  const formatTimeRange = (event: StoredEvent) => {
    if (!event.start_time && !event.end_time) return null;
    if (event.start_time && event.end_time) {
      return `${event.start_time} - ${event.end_time}`;
    }
    return event.start_time || event.end_time;
  };

  return (
    <div className="h-screen bg-neutral-950 text-neutral-100 flex">
      {/* Left Panel: Chat */}
      <div className="w-1/2 flex flex-col border-r border-neutral-800">
        {/* Chat Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
          <CalendarIcon className="w-5 h-5 text-blue-400" />
          <span className="text-neutral-300">Calendar Assistant</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-4">
            {messages.toArray().length === 0 && (
              <div className="text-neutral-500 text-sm">
                Describe your plans and I&apos;ll help you add them to your calendar.
                <br />
                <br />
                Try something like:
                <br />
                &quot;I have a dentist appointment at 2pm tomorrow&quot;
                <br />
                &quot;Plan a week of morning workouts starting Monday&quot;
              </div>
            )}
            {messages.toArray().map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onAddEvents={handleAddEvents}
                onDeclineEvents={handleDeclineEvents}
              />
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-neutral-800 text-neutral-300 rounded-lg px-4 py-2">
                  Analyzing your message...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-neutral-800 px-4 py-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Describe your plans..."
              disabled={isLoading}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={isLoading || !inputValue.trim()}
            >
              Send
            </Button>
          </form>
        </div>
      </div>

      {/* Right Panel: Calendar View */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <span className="text-neutral-300">Your Calendar</span>
          <span className="text-neutral-500 text-sm">
            {events.toArray().length} event{events.toArray().length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {/* Calendar Widget */}
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
            <Card className="bg-neutral-800 border-neutral-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-neutral-100 flex items-center justify-between">
                  <span>
                    {selectedDate
                      ? `Events on ${selectedDate.toLocaleDateString()}`
                      : "All Events"}
                  </span>
                  {selectedDate && (
                    <button
                      onClick={() => setSelectedDate(undefined)}
                      className="text-xs text-neutral-400 hover:text-neutral-200"
                    >
                      Show all
                    </button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {displayedEvents.length === 0 ? (
                  <p className="text-neutral-500 text-sm">
                    {selectedDate
                      ? "No events on this date."
                      : "No events yet. Start chatting to add some!"}
                  </p>
                ) : (
                  displayedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 rounded-lg bg-neutral-700/50 border border-neutral-600 group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="font-medium text-neutral-100">
                          {event.title}
                        </div>
                        <button
                          onClick={() => handleRemoveEvent(event.id)}
                          className="text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {!selectedDate && event.date && (
                        <div className="text-sm text-neutral-400 mt-1">
                          {new Date(event.date + "T00:00:00").toLocaleDateString()}
                        </div>
                      )}

                      {formatTimeRange(event) && (
                        <div className="flex items-center gap-1 text-sm text-neutral-400 mt-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeRange(event)}
                        </div>
                      )}

                      {event.location && (
                        <div className="flex items-center gap-1 text-sm text-neutral-400 mt-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </div>
                      )}

                      {event.description && (
                        <p className="text-sm text-neutral-300 mt-2">
                          {event.description}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  onAddEvents: (messageId: string, events: CalendarEvent[]) => void;
  onDeclineEvents: (messageId: string) => void;
}

function MessageBubble({
  message,
  onAddEvents,
  onDeclineEvents,
}: MessageBubbleProps) {
  const isUser = message.username !== "Calendar";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-neutral-800 text-neutral-100"
        }`}
      >
        <div className="text-sm">{message.content}</div>

        {/* Pending events prompt */}
        {message.pending_events && message.pending_events.length > 0 && (
          <div className="mt-3 space-y-2">
            {/* Preview events */}
            <div className="space-y-2 border-t border-neutral-700 pt-2">
              {message.pending_events.map((event, idx) => (
                <div
                  key={idx}
                  className="text-xs bg-neutral-700/50 rounded p-2"
                >
                  <div className="font-medium">{event.title}</div>
                  <div className="text-neutral-400">
                    {event.date}
                    {event.start_time && ` at ${event.start_time}`}
                    {event.location && ` - ${event.location}`}
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onAddEvents(message.id, message.pending_events!)}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors"
              >
                <Check className="w-3 h-3" />
                Add to Calendar
              </button>
              <button
                onClick={() => onDeclineEvents(message.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-neutral-600 hover:bg-neutral-500 text-white text-xs rounded transition-colors"
              >
                <X className="w-3 h-3" />
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
