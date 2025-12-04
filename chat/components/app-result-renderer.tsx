"use client";

import { CalendarCard } from "./calendar-card";
import type { RenderMode } from "@/lib/apps.config";

interface AppResultRendererProps {
  renderMode: RenderMode;
  data: any;
}

export function AppResultRenderer({
  renderMode,
  data,
}: AppResultRendererProps) {
  if (renderMode === "calendar") {
    // Render calendar card
    if (data && data.events) {
      return <CalendarCard events={data.events} />;
    }
    return null;
  }

  if (renderMode === "list") {
    // Generic list rendering (for future app types)
    return (
      <div className="bg-neutral-800 rounded-lg p-4">
        <pre className="text-neutral-300 whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  return null;
}
