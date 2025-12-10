"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { PassportPage } from "./PassportPage";
import { MonthCalendar } from "./MonthCalendar";
import { DataManager } from "./DataManager";
import type { Habit, DayStamps, StampPlacement } from "./types";

interface PassportDailyProps {
  habits: Habit[];
  dayStamps: DayStamps;
  onAddStamp: (date: string, stamp: StampPlacement) => void;
  onRemoveStamp: (date: string, index: number) => void;
  onShowSettings: () => void;
  onImportData: (habits: Habit[], dayStamps: DayStamps) => void;
}

export function PassportDaily({
  habits,
  dayStamps,
  onAddStamp,
  onRemoveStamp,
  onShowSettings,
  onImportData
}: PassportDailyProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString("default", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  const goToPreviousDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const handleDateSelect = (dateString: string) => {
    setCurrentDate(new Date(dateString));
  };

  const dateString = formatDate(currentDate);

  if (habits.length === 0) {
    return (
      <div className="bg-gradient-to-br from-red-800 to-red-900 rounded-lg shadow-2xl p-8 md:p-12 border-4 border-amber-600">
        <div className="bg-amber-50 rounded-lg p-6 md:p-8 min-h-[600px] shadow-inner border-2 border-amber-200 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">📖</div>
            <h3 className="text-green-800 mb-2">No Habits Yet!</h3>
            <p className="text-green-600 mb-6">Click &quot;Manage Habits&quot; to create your first habit stamp.</p>
            <button
              onClick={onShowSettings}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors shadow-lg inline-flex items-center gap-2"
            >
              <Settings className="size-5" />
              Manage Habits
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Passport Page with Navigation */}
      <div className="relative max-w-3xl mx-auto">
        {/* Navigation Controls */}
        <button
          onClick={goToPreviousDay}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 rounded-full hover:bg-green-50 transition-colors shadow-sm"
        >
          <ChevronLeft className="size-5 text-green-700" />
        </button>

        <button
          onClick={goToNextDay}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 rounded-full hover:bg-green-50 transition-colors shadow-sm"
        >
          <ChevronRight className="size-5 text-green-700" />
        </button>

        {/* Passport Book */}
        <PassportPage
          date={dateString}
          displayDate={formatDisplayDate(currentDate)}
          habits={habits}
          stamps={dayStamps[dateString] || []}
          onAddStamp={onAddStamp}
          onRemoveStamp={onRemoveStamp}
        />
      </div>

      {/* Manage Habits button */}
      <div className="text-center mt-8 mb-4">
        <button
          onClick={onShowSettings}
          className="px-4 py-2 bg-white text-green-700 rounded-full hover:bg-green-50 transition-colors shadow-sm inline-flex items-center gap-2 text-sm border border-gray-200"
        >
          <Settings className="size-4" />
          Manage Habits
        </button>
      </div>

      {/* Month Calendar */}
      <div className="mt-4">
        <MonthCalendar
          habits={habits}
          allStamps={dayStamps}
          currentDate={dateString}
          onDateSelect={handleDateSelect}
        />
      </div>

      {/* Data Manager */}
      <div className="mt-6 max-w-xl mx-auto">
        <DataManager
          habits={habits}
          dayStamps={dayStamps}
          onImport={onImportData}
        />
      </div>
    </div>
  );
}
