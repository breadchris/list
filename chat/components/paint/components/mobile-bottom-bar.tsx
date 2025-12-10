"use client";

import React from "react";
import {
  Pencil,
  Eraser,
  PaintBucket,
  Move,
  Pipette,
  Palette,
  Settings,
} from "lucide-react";
import { useDrawingTool, useSelectedPaletteColor } from "../hooks/use-paint-state";
import { usePaintActions } from "../hooks/use-paint-actions";
import { DRAWING_TOOLS, type DrawingTool } from "../types";

interface MobileBottomBarProps {
  onPaletteOpen: () => void;
  onSettingsOpen: () => void;
}

const tools: { id: DrawingTool; icon: React.ElementType; label: string }[] = [
  { id: DRAWING_TOOLS.PENCIL, icon: Pencil, label: "Pencil" },
  { id: DRAWING_TOOLS.ERASER, icon: Eraser, label: "Eraser" },
  { id: DRAWING_TOOLS.BUCKET, icon: PaintBucket, label: "Fill" },
  { id: DRAWING_TOOLS.EYEDROPPER, icon: Pipette, label: "Pick" },
  { id: DRAWING_TOOLS.MOVE, icon: Move, label: "Move" },
];

export function MobileBottomBar({
  onPaletteOpen,
  onSettingsOpen,
}: MobileBottomBarProps) {
  const currentTool = useDrawingTool();
  const selectedColor = useSelectedPaletteColor();
  const { switchTool } = usePaintActions();

  return (
    <div className="flex-shrink-0 border-t border-neutral-800 bg-neutral-900/95 backdrop-blur-sm safe-area-pb">
      <div className="flex items-center justify-between px-2 py-2 gap-1">
        {/* Tools */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {tools.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => switchTool(id)}
              className={`flex-shrink-0 p-2.5 rounded-lg transition-all ${
                currentTool === id
                  ? "bg-rose-500 text-white"
                  : "bg-neutral-800 text-neutral-400 active:bg-neutral-700"
              }`}
              title={label}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>

        {/* Palette & Settings */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Color/Palette button */}
          <button
            onClick={onPaletteOpen}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-neutral-800 rounded-lg active:bg-neutral-700"
          >
            {selectedColor ? (
              <div
                className="w-5 h-5 rounded border border-neutral-600"
                style={{ backgroundColor: selectedColor }}
              />
            ) : (
              <Palette className="w-5 h-5 text-neutral-400" />
            )}
          </button>

          {/* Settings button */}
          <button
            onClick={onSettingsOpen}
            className="p-2.5 bg-neutral-800 rounded-lg text-neutral-400 active:bg-neutral-700"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
