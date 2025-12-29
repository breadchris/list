"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, History, Check } from "lucide-react";
import type { TsxVersion } from "@/components/code/types";

interface CodeVersionSelectorProps {
  versions: TsxVersion[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function CodeVersionSelector({
  versions,
  selectedIndex,
  onSelect,
}: CodeVersionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (versions.length === 0) {
    return null;
  }

  const selectedVersion = versions[selectedIndex];

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const truncatePrompt = (prompt: string, maxLength = 40) => {
    if (prompt.length <= maxLength) return prompt;
    return prompt.substring(0, maxLength) + "...";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors text-sm"
      >
        <History className="w-4 h-4 text-neutral-400" />
        <span className="text-neutral-300">
          v{selectedIndex + 1} - {selectedVersion?.filename || "Component.tsx"}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-neutral-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 md:left-0 md:right-auto mt-1 w-64 md:w-72 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {versions.map((version, index) => (
              <button
                key={version.id}
                onClick={() => {
                  onSelect(index);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-3 p-3 text-left hover:bg-neutral-800 transition-colors ${
                  index === selectedIndex ? "bg-neutral-800" : ""
                }`}
              >
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    index === selectedIndex
                      ? "bg-indigo-600 text-white"
                      : "bg-neutral-700 text-neutral-400"
                  }`}
                >
                  {index === selectedIndex ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <span className="text-xs">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-200">
                      {version.filename}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {formatTimestamp(version.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 truncate">
                    {truncatePrompt(version.prompt)}
                  </p>
                  {version.error && (
                    <p className="text-xs text-red-400 mt-1">
                      Error: {version.error}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="px-3 py-2 bg-neutral-800 border-t border-neutral-700">
            <p className="text-xs text-neutral-500">
              {versions.length} version{versions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
