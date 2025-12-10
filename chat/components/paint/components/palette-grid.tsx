"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { usePalette } from "../hooks/use-paint-state";
import { usePaintActions } from "../hooks/use-paint-actions";
import { PaletteColor } from "./palette-color";
import { ColorPickerModal } from "./color-picker-modal";

export function PaletteGrid() {
  const palette = usePalette();
  const { selectPaletteColor, setCustomColor } = usePaintActions();
  const [showColorPicker, setShowColorPicker] = useState(false);

  const { grid, position } = palette;

  const handleColorSelect = (index: number) => {
    selectPaletteColor(index);
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
          Palette
        </span>
        <button
          onClick={() => setShowColorPicker(true)}
          className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
          title="Custom color"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-6 gap-1">
        {grid.map((colorItem, index) => (
          <PaletteColor
            key={colorItem.id}
            color={colorItem.color}
            isSelected={position === index}
            onClick={() => handleColorSelect(index)}
          />
        ))}
      </div>

      {/* Current color preview */}
      {position >= 0 && position < grid.length && (
        <div className="pt-2 border-t border-neutral-800">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded border border-neutral-700"
              style={{ backgroundColor: grid[position]?.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-neutral-400 truncate">
                {grid[position]?.color}
              </div>
            </div>
          </div>
        </div>
      )}

      {showColorPicker && (
        <ColorPickerModal
          currentColor={position >= 0 && position < grid.length ? grid[position]?.color : "#000000"}
          onColorChange={handleCustomColorChange}
          onClose={() => setShowColorPicker(false)}
        />
      )}
    </div>
  );
}
