"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { Habit, StampPlacement } from "./types";

interface MonthCalendarProps {
  habits: Habit[];
  allStamps: Record<string, StampPlacement[]>;
  currentDate: string;
  onDateSelect: (date: string) => void;
}

export function MonthCalendar({ habits, allStamps, currentDate, onDateSelect }: MonthCalendarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date(currentDate));

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(viewMonth);

  const getDateString = (day: number) => {
    const date = new Date(year, month, day);
    return date.toISOString().split("T")[0];
  };

  const getStampsForDay = (day: number) => {
    const dateStr = getDateString(day);
    return allStamps[dateStr] || [];
  };

  const getTotalStampsInMonth = () => {
    let total = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      total += getStampsForDay(day).length;
    }
    return total;
  };

  const previousMonth = () => {
    setViewMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewMonth(new Date(year, month + 1, 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isCurrentViewDate = (day: number) => {
    const dateStr = getDateString(day);
    return dateStr === currentDate;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const totalStamps = getTotalStampsInMonth();

  return (
    <div className="max-w-5xl mx-auto">
      {/* Toggle Button */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-white/60 hover:bg-white/80 text-gray-600 hover:text-gray-800 rounded-lg p-3 border border-gray-200 flex items-center justify-center gap-2 transition-all text-sm"
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
      >
        <Calendar className="w-4 h-4" />
        <span>
          {isExpanded ? "Hide" : "View"} Calendar
        </span>
        {!isExpanded && totalStamps > 0 && (
          <span className="text-gray-500 text-xs">
            ({totalStamps} stamps)
          </span>
        )}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronRight className="w-4 h-4" />
        </motion.div>
      </motion.button>

      {/* Calendar View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-b-2xl shadow-2xl p-6 border-t-4 border-green-500">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6">
                <motion.button
                  onClick={previousMonth}
                  className="p-2 rounded-full hover:bg-green-100 text-green-700 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronLeft className="w-6 h-6" />
                </motion.button>

                <motion.h2
                  key={`${month}-${year}`}
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-2xl text-green-800"
                  style={{ fontFamily: "cursive" }}
                >
                  {monthNames[month]} {year}
                </motion.h2>

                <motion.button
                  onClick={nextMonth}
                  className="p-2 rounded-full hover:bg-green-100 text-green-700 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronRight className="w-6 h-6" />
                </motion.button>
              </div>

              {/* Day Names */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {dayNames.map((day) => (
                  <div
                    key={day}
                    className="text-center text-green-600 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Empty cells */}
                {Array.from({ length: startingDayOfWeek }).map((_, index) => (
                  <div key={`empty-${index}`} className="aspect-square" />
                ))}

                {/* Days */}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const stamps = getStampsForDay(day);
                  const today = isToday(day);
                  const selected = isCurrentViewDate(day);

                  return (
                    <motion.button
                      key={day}
                      onClick={() => {
                        onDateSelect(getDateString(day));
                        setIsExpanded(false);
                      }}
                      className={`aspect-square rounded-xl p-2 border-2 transition-all relative overflow-hidden
                        ${today ? "border-yellow-400 bg-yellow-50" : "border-gray-200 bg-gray-50"}
                        ${selected ? "ring-4 ring-green-400 bg-green-50" : ""}
                        ${stamps.length > 0 ? "hover:bg-green-100" : "hover:bg-gray-100"}
                      `}
                      whileHover={{ scale: 1.05, rotate: stamps.length > 0 ? 2 : 0 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.01 }}
                    >
                      {/* Day number */}
                      <div className={`text-sm mb-1 ${today ? "font-bold text-yellow-700" : "text-gray-600"}`}>
                        {day}
                      </div>

                      {/* Mini stamps */}
                      {stamps.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 items-center justify-center">
                          {stamps.slice(0, 6).map((stamp, idx) => {
                            const habit = habits.find(h => h.id === stamp.habitId);
                            if (!habit) return null;

                            return (
                              <motion.div
                                key={idx}
                                className="w-4 h-4 rounded-full flex items-center justify-center text-xs shadow-sm"
                                style={{
                                  backgroundColor: habit.color,
                                  opacity: 0.9,
                                }}
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{
                                  delay: index * 0.01 + idx * 0.05,
                                  type: "spring",
                                  stiffness: 500,
                                  damping: 15,
                                }}
                                whileHover={{ scale: 1.3, zIndex: 10 }}
                              >
                                <span className="text-white" style={{ fontSize: "8px" }}>
                                  {habit.icon}
                                </span>
                              </motion.div>
                            );
                          })}
                          {stamps.length > 6 && (
                            <div className="w-4 h-4 rounded-full bg-green-600 text-white flex items-center justify-center shadow-sm" style={{ fontSize: "6px" }}>
                              +{stamps.length - 6}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Today indicator */}
                      {today && (
                        <motion.div
                          className="absolute bottom-1 left-1/2 transform -translate-x-1/2"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.3, type: "spring" }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                        </motion.div>
                      )}

                      {/* Stamp count badge */}
                      {stamps.length > 3 && (
                        <motion.div
                          className="absolute top-0 right-0 bg-green-600 text-white rounded-bl-lg px-1"
                          style={{ fontSize: "8px" }}
                          initial={{ x: 10, y: -10, opacity: 0 }}
                          animate={{ x: 0, y: 0, opacity: 1 }}
                          transition={{ delay: index * 0.01 + 0.2 }}
                        >
                          {stamps.length}
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Stats */}
              <motion.div
                className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl">🎯</div>
                    <div className="text-green-900">{totalStamps} Total Stamps</div>
                  </div>
                  <div>
                    <div className="text-2xl">📅</div>
                    <div className="text-green-900">
                      {Object.keys(allStamps).filter(date => {
                        const d = new Date(date);
                        return d.getMonth() === month && d.getFullYear() === year;
                      }).length} Active Days
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl">⭐</div>
                    <div className="text-green-900">
                      {habits.length} Habits
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl">🔥</div>
                    <div className="text-green-900">
                      Keep Going!
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
