"use client";

import { Eraser } from "lucide-react";

interface BackgroundToolProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  isProcessing: boolean;
  progress: number;
}

export function BackgroundTool({
  enabled,
  onToggle,
  isProcessing,
  progress,
}: BackgroundToolProps) {
  return (
    <div className="space-y-2">
      <button
        onClick={() => onToggle(!enabled)}
        disabled={isProcessing}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
          enabled
            ? "bg-fuchsia-500 text-white"
            : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
        } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <Eraser className="w-4 h-4" />
        <span>Remove Background</span>
      </button>

      {enabled && (
        <p className="text-xs text-neutral-400">
          Background removal will be applied when you export.
          {isProcessing && ` Processing... ${progress}%`}
        </p>
      )}

      {isProcessing && (
        <div className="w-full bg-neutral-700 rounded-full h-2">
          <div
            className="bg-fuchsia-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
