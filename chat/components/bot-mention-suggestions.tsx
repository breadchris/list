"use client";

import { useEffect, useRef } from "react";
import type { BotConfig } from "@/lib/bots.config";

interface BotMentionSuggestionsProps {
  bots: BotConfig[];
  filter: string;
  selectedIndex: number;
  visible: boolean;
  onSelect: (bot: BotConfig) => void;
  onClose: () => void;
}

export function BotMentionSuggestions({
  bots,
  filter,
  selectedIndex,
  visible,
  onSelect,
  onClose,
}: BotMentionSuggestionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Filter bots based on input
  const filteredBots = bots.filter((bot) =>
    bot.mention.toLowerCase().startsWith(filter.toLowerCase())
  );

  // Scroll selected item into view
  useEffect(() => {
    if (visible && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, visible]);

  // Close on click outside
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [visible, onClose]);

  if (filteredBots.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`absolute bottom-full left-0 right-0 mb-2 bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg overflow-hidden transition-all duration-150 ease-out ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <div className="max-h-48 overflow-y-auto">
        {filteredBots.map((bot, index) => (
          <button
            key={bot.id}
            ref={index === selectedIndex ? selectedRef : null}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(bot)}
            className={`w-full px-3 py-2 text-left font-mono text-sm flex items-center gap-3 transition-colors ${
              index === selectedIndex
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
            }`}
          >
            <span className="text-neutral-500">@</span>
            <span className="text-neutral-200">{bot.mention}</span>
            <span className="text-neutral-600 text-xs ml-auto">{bot.display_name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
