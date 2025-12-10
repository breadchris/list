"use client";

import { useState, useCallback } from "react";
import { useMap, useArray } from "@y-sweet/react";
import { PassportDaily } from "./PassportDaily";
import { HabitManager } from "./HabitManager";
import type { Habit, StampPlacement, DayStamps } from "./types";

export function DoAppInterface() {
  // Y-Sweet state for real-time collaboration
  const habitsArray = useArray<Habit>("habits");
  const dayStampsMap = useMap<StampPlacement[]>("dayStamps");

  const [showSettings, setShowSettings] = useState(false);

  // Convert Yjs array to regular array
  const habits = habitsArray?.toArray() ?? [];

  // Convert Yjs map to regular object
  const dayStamps: DayStamps = {};
  if (dayStampsMap) {
    dayStampsMap.forEach((value, key) => {
      dayStamps[key] = value;
    });
  }

  const addHabit = useCallback((name: string, icon: string, color: string) => {
    if (!habitsArray) return;

    const newHabit: Habit = {
      id: Date.now().toString(),
      name,
      icon,
      color,
      createdAt: new Date().toISOString(),
    };
    habitsArray.push([newHabit]);
  }, [habitsArray]);

  const deleteHabit = useCallback((habitId: string) => {
    if (!habitsArray) return;

    const index = habits.findIndex(h => h.id === habitId);
    if (index !== -1) {
      habitsArray.delete(index, 1);
    }
  }, [habitsArray, habits]);

  const addStamp = useCallback((date: string, stamp: StampPlacement) => {
    if (!dayStampsMap) return;

    const existing = dayStampsMap.get(date) ?? [];
    dayStampsMap.set(date, [...existing, stamp]);
  }, [dayStampsMap]);

  const removeStamp = useCallback((date: string, index: number) => {
    if (!dayStampsMap) return;

    const existing = dayStampsMap.get(date) ?? [];
    const updated = existing.filter((_, i) => i !== index);
    dayStampsMap.set(date, updated);
  }, [dayStampsMap]);

  const handleImportData = useCallback((importedHabits: Habit[], importedDayStamps: DayStamps) => {
    if (!habitsArray || !dayStampsMap) return;

    // Clear existing habits and add imported ones
    while (habitsArray.length > 0) {
      habitsArray.delete(0, 1);
    }
    habitsArray.push(importedHabits);

    // Clear existing stamps and add imported ones
    dayStampsMap.forEach((_, key) => {
      dayStampsMap.delete(key);
    });
    Object.entries(importedDayStamps).forEach(([date, stamps]) => {
      dayStampsMap.set(date, stamps);
    });
  }, [habitsArray, dayStampsMap]);

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-amber-50 via-green-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {showSettings ? (
          <HabitManager
            habits={habits}
            onAddHabit={addHabit}
            onDeleteHabit={deleteHabit}
            onBack={() => setShowSettings(false)}
          />
        ) : (
          <PassportDaily
            habits={habits}
            dayStamps={dayStamps}
            onAddStamp={addStamp}
            onRemoveStamp={removeStamp}
            onShowSettings={() => setShowSettings(true)}
            onImportData={handleImportData}
          />
        )}
      </div>
    </div>
  );
}
