"use client";

import React, { useState } from "react";
import {
  Pencil,
  Eraser,
  PaintBucket,
  Move,
  Pipette,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useDrawingTool } from "../hooks/use-paint-state";
import { usePaintActions } from "../hooks/use-paint-actions";
import { DRAWING_TOOLS, type DrawingTool } from "../types";
import { AIDrawPanel } from "./ai-draw-panel";

interface ToolButtonProps {
  tool: DrawingTool;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function ToolButton({ tool, icon: Icon, label, isActive, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-2.5 rounded-lg transition-all ${
        isActive
          ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
          : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
      }`}
      title={label}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

const tools: { id: DrawingTool; icon: React.ElementType; label: string }[] = [
  { id: DRAWING_TOOLS.PENCIL, icon: Pencil, label: "Pencil (P)" },
  { id: DRAWING_TOOLS.ERASER, icon: Eraser, label: "Eraser (E)" },
  { id: DRAWING_TOOLS.BUCKET, icon: PaintBucket, label: "Fill (B)" },
  { id: DRAWING_TOOLS.EYEDROPPER, icon: Pipette, label: "Eyedropper (I)" },
  { id: DRAWING_TOOLS.MOVE, icon: Move, label: "Move (M)" },
];

export function Toolbar() {
  const currentTool = useDrawingTool();
  const { switchTool, resetGrid } = usePaintActions();
  const [aiPanelOpen, setAIPanelOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
        Tools
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {tools.map(({ id, icon, label }) => (
          <ToolButton
            key={id}
            tool={id}
            icon={icon}
            label={label}
            isActive={currentTool === id}
            onClick={() => switchTool(id)}
          />
        ))}
      </div>

      <div className="pt-2 border-t border-neutral-800 space-y-1.5">
        {aiPanelOpen ? (
          <AIDrawPanel onClose={() => setAIPanelOpen(false)} />
        ) : (
          <button
            onClick={() => setAIPanelOpen(true)}
            className="w-full flex items-center justify-center gap-2 p-2 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 hover:text-purple-300 rounded-lg transition-colors"
            title="AI Draw"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-xs">AI Draw</span>
          </button>
        )}

        <button
          onClick={resetGrid}
          className="w-full flex items-center justify-center gap-2 p-2 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 rounded-lg transition-colors"
          title="Clear canvas"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-xs">Clear</span>
        </button>
      </div>
    </div>
  );
}
