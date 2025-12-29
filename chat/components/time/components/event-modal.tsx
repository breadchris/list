"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { TimeEvent } from "@/types/time";

interface EventModalProps {
  event: TimeEvent | null;
  onSave: (event: Omit<TimeEvent, "id" | "created_at" | "updated_at" | "user_color">) => void;
  onDelete: (eventId: string) => void;
  onClose: () => void;
  initialDate?: Date | null;
  userId: string;
  userName?: string;
}

export function EventModal({
  event,
  onSave,
  onDelete,
  onClose,
  initialDate,
  userId,
  userName,
}: EventModalProps) {
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    if (event) {
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);

      setStartDate(formatDateForInput(start));
      setStartTime(formatTimeForInput(start));
      setEndDate(formatDateForInput(end));
      setEndTime(formatTimeForInput(end));
    } else if (initialDate) {
      const start = new Date(initialDate);
      const end = new Date(initialDate);
      end.setHours(end.getHours() + 1);

      setStartDate(formatDateForInput(start));
      setStartTime(formatTimeForInput(start));
      setEndDate(formatDateForInput(end));
      setEndTime(formatTimeForInput(end));
    } else {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const later = new Date(now);
      later.setHours(later.getHours() + 1);

      setStartDate(formatDateForInput(now));
      setStartTime(formatTimeForInput(now));
      setEndDate(formatDateForInput(later));
      setEndTime(formatTimeForInput(later));
    }
  }, [event, initialDate]);

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatTimeForInput = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const startDateTime = new Date(startYear, startMonth - 1, startDay, startHour, startMinute);
    const endDateTime = new Date(endYear, endMonth - 1, endDay, endHour, endMinute);

    onSave({
      title: title || "Untitled Event",
      description: description || undefined,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      user_id: userId,
      user_name: userName,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg max-w-lg w-full shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-neutral-700">
          <h2 className="text-neutral-100 font-medium text-lg">
            {event ? "Edit Event" : "New Event"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-neutral-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-neutral-300 mb-2 text-sm">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                placeholder="Event title"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-neutral-300 mb-2 text-sm">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-neutral-300 mb-2 text-sm">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-neutral-300 mb-2 text-sm">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-neutral-300 mb-2 text-sm">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-neutral-300 mb-2 text-sm">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-neutral-700">
            {event ? (
              <button
                type="button"
                onClick={() => onDelete(event.id)}
                className="px-4 py-2 text-sm whitespace-nowrap border border-red-500/50 rounded-lg hover:border-red-500 hover:bg-red-500/10 text-red-400 transition-all"
              >
                Delete
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm whitespace-nowrap border border-neutral-700 rounded-lg hover:border-neutral-500 hover:bg-neutral-800 text-neutral-300 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm whitespace-nowrap bg-sky-600 text-white rounded-lg hover:bg-sky-500 transition-all"
              >
                {event ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
