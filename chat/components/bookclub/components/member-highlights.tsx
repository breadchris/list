"use client";

import { Highlighter, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { Highlight } from "@/types/reading-position";

// Map color names to Tailwind classes
const colorMap: Record<string, { bg: string; border: string }> = {
  yellow: { bg: "bg-yellow-500/20", border: "border-yellow-500/30" },
  green: { bg: "bg-green-500/20", border: "border-green-500/30" },
  blue: { bg: "bg-blue-500/20", border: "border-blue-500/30" },
  pink: { bg: "bg-pink-500/20", border: "border-pink-500/30" },
  purple: { bg: "bg-purple-500/20", border: "border-purple-500/30" },
  orange: { bg: "bg-orange-500/20", border: "border-orange-500/30" },
};

interface MemberHighlightsProps {
  memberName: string;
  highlights: Highlight[];
  isCurrentUser?: boolean;
  defaultExpanded?: boolean;
}

export function MemberHighlights({
  memberName,
  highlights,
  isCurrentUser = false,
  defaultExpanded = false,
}: MemberHighlightsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (highlights.length === 0) {
    return null;
  }

  const getColorClasses = (color: string) => {
    return colorMap[color] || colorMap.yellow;
  };

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-neutral-800/50 hover:bg-neutral-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Highlighter className="w-4 h-4 text-yellow-400" />
          <span
            className={`text-sm font-medium ${
              isCurrentUser ? "text-orange-300" : "text-neutral-300"
            }`}
          >
            {isCurrentUser ? "Your Highlights" : `${memberName}'s Highlights`}
          </span>
          <span className="text-xs text-neutral-500">
            ({highlights.length})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-neutral-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-neutral-500" />
        )}
      </button>

      {/* Highlights list */}
      {isExpanded && (
        <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
          {highlights.map((highlight) => {
            const colors = getColorClasses(highlight.color);
            return (
              <div
                key={highlight.id}
                className={`p-2 rounded border ${colors.bg} ${colors.border}`}
              >
                <p className="text-sm text-neutral-200 italic">
                  "{highlight.text}"
                </p>
                {highlight.note && (
                  <p className="text-xs text-neutral-400 mt-1.5 pl-2 border-l-2 border-neutral-600">
                    {highlight.note}
                  </p>
                )}
                <p className="text-[10px] text-neutral-500 mt-1.5">
                  {new Date(highlight.created_at).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
