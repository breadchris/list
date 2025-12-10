"use client";

import { useEffect } from "react";
import { BookOpen, X } from "lucide-react";
import { useSetAppSettings } from "./AppSettingsContext";

interface ReaderSettingsPanelProps {
  bookName: string | null;
  onClearBook: () => void;
}

export function ReaderSettingsPanel({
  bookName,
  onClearBook,
}: ReaderSettingsPanelProps) {
  const setAppSettings = useSetAppSettings();

  useEffect(() => {
    if (bookName) {
      setAppSettings(
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-sm text-neutral-300 truncate">{bookName}</span>
          </div>
          <button
            onClick={onClearBook}
            className="text-xs text-neutral-400 hover:text-neutral-200 flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        </div>
      );
    } else {
      setAppSettings(null);
    }

    return () => {
      setAppSettings(null);
    };
  }, [bookName, onClearBook, setAppSettings]);

  return null;
}
