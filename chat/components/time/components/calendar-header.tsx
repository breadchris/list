"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TimeViewType } from "@/types/time";

interface CalendarHeaderProps {
  view: TimeViewType;
  onViewChange: (view: TimeViewType) => void;
  currentDate: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

const views: { key: TimeViewType; label: string; short: string }[] = [
  { key: "month", label: "Month", short: "M" },
  { key: "week", label: "Week", short: "W" },
  { key: "day", label: "Day", short: "D" },
  { key: "schedule", label: "Schedule", short: "S" },
];

export function CalendarHeader({
  view,
  onViewChange,
  currentDate,
  onPrevious,
  onNext,
  onToday,
}: CalendarHeaderProps) {
  const formatTitle = () => {
    const options: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };
    if (view === "day") {
      return currentDate.toLocaleDateString("en-US", { ...options, day: "numeric" });
    }
    return currentDate.toLocaleDateString("en-US", options);
  };

  return (
    <div className="border-b border-neutral-800 bg-neutral-900">
      <div className="px-4 md:px-8 py-3 md:py-4">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Navigation and date */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {/* Desktop arrows */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={onPrevious}
                className="p-2 border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800 rounded transition-colors text-neutral-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={onNext}
                className="p-2 border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800 rounded transition-colors text-neutral-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Date display */}
            <div className="text-neutral-200 text-base font-medium">
              {formatTitle()}
            </div>

            {/* Today button - subtle on mobile */}
            <button
              onClick={onToday}
              className="px-2 py-1 md:px-3 md:py-2 text-xs md:text-sm text-neutral-400 hover:text-neutral-200 md:border md:border-neutral-700 md:hover:border-neutral-500 md:hover:bg-neutral-800 rounded transition-colors"
            >
              Today
            </button>
          </div>

          {/* Right: View selector */}
          {/* Mobile: Segmented control */}
          <div className="flex md:hidden border border-neutral-700 rounded-lg overflow-hidden">
            {views.map(({ key, short }) => (
              <button
                key={key}
                onClick={() => onViewChange(key)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === key
                    ? "bg-neutral-700 text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {short}
              </button>
            ))}
          </div>

          {/* Desktop: Dropdown */}
          <select
            value={view}
            onChange={(e) => onViewChange(e.target.value as TimeViewType)}
            className="hidden md:block px-3 py-2 border border-neutral-700 hover:border-neutral-500 rounded transition-colors text-sm bg-neutral-800 text-neutral-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {views.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
