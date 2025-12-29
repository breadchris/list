"use client";

import { useMemo, useSyncExternalStore, useCallback, useRef } from "react";
import { useYDoc } from "@y-sweet/react";
import * as Y from "yjs";
import type { TimeEvent } from "@/types/time";
import { getUserColor } from "@/types/time";

// Hook to subscribe to Y.js document changes for events
function useEventsSubscription(doc: Y.Doc | null) {
  const snapshotRef = useRef<TimeEvent[]>([]);
  const snapshotJsonRef = useRef<string>("[]");

  const subscribe = useCallback(
    (callback: () => void) => {
      if (!doc) return () => {};
      const rootMap = doc.getMap("timeState");

      const handler = () => {
        const eventsMap = rootMap.get("events") as Y.Map<Y.Map<unknown>> | undefined;
        if (!eventsMap) {
          if (snapshotJsonRef.current !== "[]") {
            snapshotJsonRef.current = "[]";
            snapshotRef.current = [];
            callback();
          }
          return;
        }

        const events: TimeEvent[] = [];
        eventsMap.forEach((eventMap) => {
          events.push({
            id: eventMap.get("id") as string,
            title: eventMap.get("title") as string,
            start_time: eventMap.get("start_time") as string,
            end_time: eventMap.get("end_time") as string,
            user_id: eventMap.get("user_id") as string,
            user_name: eventMap.get("user_name") as string | undefined,
            user_color: eventMap.get("user_color") as string | undefined,
            description: eventMap.get("description") as string | undefined,
            created_at: eventMap.get("created_at") as string,
            updated_at: eventMap.get("updated_at") as string,
          });
        });

        // Sort by start time
        events.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        const newJson = JSON.stringify(events);
        if (newJson !== snapshotJsonRef.current) {
          snapshotJsonRef.current = newJson;
          snapshotRef.current = events;
          callback();
        }
      };

      rootMap.observeDeep(handler);

      // Initialize snapshot
      handler();

      return () => rootMap.unobserveDeep(handler);
    },
    [doc]
  );

  const getSnapshot = useCallback(() => {
    return snapshotRef.current;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Main time events hook
export function useTimeEvents() {
  const doc = useYDoc();
  const events = useEventsSubscription(doc);

  // Get or create events map
  const getEventsMap = useCallback(() => {
    if (!doc) return null;
    const rootMap = doc.getMap("timeState");
    let eventsMap = rootMap.get("events") as Y.Map<Y.Map<unknown>> | undefined;
    if (!eventsMap) {
      eventsMap = new Y.Map();
      rootMap.set("events", eventsMap);
    }
    return eventsMap;
  }, [doc]);

  // Create a new event
  const createEvent = useCallback(
    (event: Omit<TimeEvent, "id" | "created_at" | "updated_at" | "user_color">) => {
      if (!doc) return null;
      const eventsMap = getEventsMap();
      if (!eventsMap) return null;

      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const userColor = getUserColor(event.user_id);

      doc.transact(() => {
        const eventMap = new Y.Map();
        eventMap.set("id", id);
        eventMap.set("title", event.title);
        eventMap.set("start_time", event.start_time);
        eventMap.set("end_time", event.end_time);
        eventMap.set("user_id", event.user_id);
        if (event.user_name) eventMap.set("user_name", event.user_name);
        eventMap.set("user_color", userColor);
        if (event.description) eventMap.set("description", event.description);
        eventMap.set("created_at", now);
        eventMap.set("updated_at", now);
        eventsMap.set(id, eventMap);
      });

      return {
        ...event,
        id,
        user_color: userColor,
        created_at: now,
        updated_at: now,
      } as TimeEvent;
    },
    [doc, getEventsMap]
  );

  // Update an existing event
  const updateEvent = useCallback(
    (eventId: string, updates: Partial<Omit<TimeEvent, "id" | "created_at" | "updated_at">>) => {
      if (!doc) return;
      const eventsMap = getEventsMap();
      if (!eventsMap) return;

      const eventMap = eventsMap.get(eventId);
      if (!eventMap) return;

      doc.transact(() => {
        if (updates.title !== undefined) eventMap.set("title", updates.title);
        if (updates.start_time !== undefined) eventMap.set("start_time", updates.start_time);
        if (updates.end_time !== undefined) eventMap.set("end_time", updates.end_time);
        if (updates.description !== undefined) eventMap.set("description", updates.description);
        if (updates.user_id !== undefined) {
          eventMap.set("user_id", updates.user_id);
          eventMap.set("user_color", getUserColor(updates.user_id));
        }
        if (updates.user_name !== undefined) eventMap.set("user_name", updates.user_name);
        eventMap.set("updated_at", new Date().toISOString());
      });
    },
    [doc, getEventsMap]
  );

  // Delete an event
  const deleteEvent = useCallback(
    (eventId: string) => {
      if (!doc) return;
      const eventsMap = getEventsMap();
      if (!eventsMap) return;

      doc.transact(() => {
        eventsMap.delete(eventId);
      });
    },
    [doc, getEventsMap]
  );

  // Get event by ID
  const getEventById = useCallback(
    (eventId: string): TimeEvent | null => {
      return events.find((e) => e.id === eventId) || null;
    },
    [events]
  );

  // Get events for a specific date
  const getEventsForDate = useCallback(
    (date: Date): TimeEvent[] => {
      const dateStr = date.toISOString().split("T")[0];
      return events.filter((event) => {
        const eventDateStr = event.start_time.split("T")[0];
        return eventDateStr === dateStr;
      });
    },
    [events]
  );

  // Get events for a date range
  const getEventsInRange = useCallback(
    (start: Date, end: Date): TimeEvent[] => {
      const startTime = start.getTime();
      const endTime = end.getTime();
      return events.filter((event) => {
        const eventStart = new Date(event.start_time).getTime();
        const eventEnd = new Date(event.end_time).getTime();
        // Event overlaps with range if it starts before range ends and ends after range starts
        return eventStart < endTime && eventEnd > startTime;
      });
    },
    [events]
  );

  return {
    events,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventById,
    getEventsForDate,
    getEventsInRange,
  };
}

// Hook for events only (read-only)
export function useEvents(): TimeEvent[] {
  const { events } = useTimeEvents();
  return events;
}

// Hook for event actions only
export function useEventActions() {
  const { createEvent, updateEvent, deleteEvent } = useTimeEvents();
  return { createEvent, updateEvent, deleteEvent };
}
