"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Habit } from "./types";

interface HabitManagerProps {
  habits: Habit[];
  onAddHabit: (name: string, icon: string, color: string) => void;
  onDeleteHabit: (habitId: string) => void;
  onBack: () => void;
}

const PRESET_ICONS = ["🏃", "📚", "💧", "🧘", "✍️", "🎨", "💪", "🥗", "😴", "🎵", "🌱", "🧹", "☕", "🎯", "❤️", "🚴"];
const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e"
];

export function HabitManager({ habits, onAddHabit, onDeleteHabit, onBack }: HabitManagerProps) {
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("🌱");
  const [selectedColor, setSelectedColor] = useState("#22c55e");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAddHabit(name.trim(), selectedIcon, selectedColor);
      setName("");
      setSelectedIcon("🌱");
      setSelectedColor("#22c55e");
    }
  };

  return (
    <>
      <div className="bg-gradient-to-br from-red-800 to-red-900 rounded-lg shadow-2xl p-4 md:p-8 lg:p-12 border-4 border-amber-600">
        <div className="bg-amber-50 rounded-lg p-4 md:p-6 lg:p-8 shadow-inner border-2 border-amber-200">
          {/* Add New Habit Form */}
          <form onSubmit={handleSubmit} className="mb-6 md:mb-8 p-4 md:p-6 bg-white rounded-lg border-2 border-green-300">
            <h3 className="text-green-800 mb-4 md:mb-6">Create New Stamp</h3>

            <div className="space-y-5 md:space-y-6">
              <div>
                <Label htmlFor="habit-name" className="text-green-800">Habit Name</Label>
                <Input
                  id="habit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Morning Exercise"
                  className="mt-2 border-2 border-green-300 focus:border-green-500 text-base"
                />
              </div>

              <div>
                <Label className="text-green-800 block mb-3">Choose an Icon</Label>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 md:gap-2">
                  {PRESET_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setSelectedIcon(icon)}
                      className={`aspect-square text-3xl md:text-2xl rounded-lg transition-all ${
                        selectedIcon === icon
                          ? "bg-green-600 shadow-lg scale-110"
                          : "bg-amber-50 hover:bg-green-50 border-2 border-green-200"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-green-800 block mb-3">Choose a Color</Label>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2.5 md:gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`aspect-square rounded-lg transition-all min-h-[44px] md:min-h-0 ${
                        selectedColor === color
                          ? "ring-4 ring-green-600 ring-offset-2 scale-110"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white h-12 md:h-10"
              >
                <Plus className="size-4 mr-2" />
                Create Stamp
              </Button>
            </div>
          </form>

          {/* Existing Habits */}
          <div className="mb-6">
            {habits.length === 0 ? (
              <div className="text-center py-12 text-green-600">
                <p>No stamps yet. Create your first habit stamp above!</p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex gap-3 md:gap-4 min-w-min">
                  {habits.map((habit) => (
                    <div
                      key={habit.id}
                      className="bg-white rounded-lg p-3 md:p-4 border-2 border-green-200 shadow-md hover:shadow-lg transition-shadow flex-shrink-0 w-36 md:w-40"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div
                          className="w-12 h-12 md:w-12 md:h-12 rounded-full flex items-center justify-center text-2xl shadow-md"
                          style={{ backgroundColor: habit.color }}
                        >
                          {habit.icon}
                        </div>
                        <button
                          onClick={() => onDeleteHabit(habit.id)}
                          className="text-red-600 hover:text-red-700 p-1.5 md:p-1 -mt-1 -mr-1"
                        >
                          <Trash2 className="size-4 md:size-4" />
                        </button>
                      </div>
                      <p className="text-green-900 truncate text-sm md:text-base">{habit.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Back button */}
          <div className="text-center">
            <button
              onClick={onBack}
              className="px-5 py-2.5 md:px-6 md:py-2 bg-white text-green-700 rounded-full hover:bg-green-50 transition-colors shadow-md inline-flex items-center gap-2 border-2 border-green-200 text-sm md:text-base"
            >
              ← Back to Passport
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
