"use client";

import { useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import type { Habit, DayStamps, StampPlacement } from "./types";

interface DataManagerProps {
  habits: Habit[];
  dayStamps: DayStamps;
  onImport: (habits: Habit[], dayStamps: DayStamps) => void;
}

export function DataManager({ habits, dayStamps, onImport }: DataManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<{ habits: Habit[], dayStamps: DayStamps } | null>(null);

  const handleExport = () => {
    const data = {
      habits,
      dayStamps,
      exportedAt: new Date().toISOString(),
      version: "1.0"
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `habit-tracker-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (!data.habits || !Array.isArray(data.habits)) {
          alert("Invalid backup file: missing or invalid habits data");
          return;
        }

        if (!data.dayStamps || typeof data.dayStamps !== "object") {
          alert("Invalid backup file: missing or invalid stamps data");
          return;
        }

        setImportData({
          habits: data.habits,
          dayStamps: data.dayStamps
        });
      } catch {
        alert("Error reading backup file. Please make sure it's a valid backup file.");
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  const handleReplace = () => {
    if (!importData) return;

    onImport(importData.habits, importData.dayStamps);
    setImportData(null);
    alert("Data replaced successfully!");
  };

  const handleMerge = () => {
    if (!importData) return;

    const existingHabitIds = new Set(habits.map(h => h.id));
    const newHabits = importData.habits.filter(h => !existingHabitIds.has(h.id));
    const mergedHabits = [...habits, ...newHabits];

    const mergedDayStamps: DayStamps = { ...dayStamps };

    Object.entries(importData.dayStamps).forEach(([date, stamps]) => {
      if (!mergedDayStamps[date]) {
        mergedDayStamps[date] = stamps;
      } else {
        const existingStampIds = new Set(mergedDayStamps[date].map(s => s.id).filter(Boolean));
        const newStamps = stamps.filter(s => !s.id || !existingStampIds.has(s.id));
        mergedDayStamps[date] = [...mergedDayStamps[date], ...newStamps];
      }
    });

    onImport(mergedHabits, mergedDayStamps);
    setImportData(null);
    alert("Data merged successfully!");
  };

  const handleCancel = () => {
    setImportData(null);
  };

  return (
    <>
      <div className="bg-white rounded-lg border-2 border-green-200 p-4 shadow-sm">
        <h3 className="text-green-800 mb-3 text-center text-sm font-medium">Backup & Restore</h3>
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors inline-flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            <Download className="size-4" />
            Export Data
          </button>

          <button
            onClick={handleImportClick}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-green-50 text-green-700 border-2 border-green-300 rounded-lg transition-colors inline-flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            <Upload className="size-4" />
            Import Data
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        <p className="text-xs text-green-600 text-center mt-3">
          Export your data to backup or transfer to another device
        </p>
      </div>

      {/* Import Options Modal */}
      {importData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-green-800 font-medium">Import Data</h3>
              <button
                onClick={handleCancel}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="size-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 mb-2">
                  <strong>Importing:</strong>
                </p>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• {importData.habits.length} habits</li>
                  <li>• {Object.keys(importData.dayStamps).length} days of stamps</li>
                </ul>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleReplace}
                  className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                >
                  <strong>Replace</strong> existing data
                  <p className="text-xs opacity-90 mt-1">Delete all current data and use only imported data</p>
                </button>

                <button
                  onClick={handleMerge}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                >
                  <strong>Merge</strong> with existing data
                  <p className="text-xs opacity-90 mt-1">Add new habits and stamps; keep existing ones. Duplicates removed by UUID.</p>
                </button>

                <button
                  onClick={handleCancel}
                  className="w-full px-4 py-3 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
