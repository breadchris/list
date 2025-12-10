"use client";

import React, { useState, useCallback } from "react";
import { X } from "lucide-react";

interface ColorPickerModalProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
}

// Parse rgba string to components
function parseRgba(color: string): { r: number; g: number; b: number; a: number } {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      a: match[4] ? parseFloat(match[4]) : 1,
    };
  }
  // Try hex
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
      a: 1,
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

// Convert to rgba string
function toRgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Convert to hex for input
function toHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
}

export function ColorPickerModal({
  currentColor,
  onColorChange,
  onClose,
}: ColorPickerModalProps) {
  const parsed = parseRgba(currentColor);
  const [r, setR] = useState(parsed.r);
  const [g, setG] = useState(parsed.g);
  const [b, setB] = useState(parsed.b);
  const [a, setA] = useState(parsed.a);

  const handleApply = useCallback(() => {
    onColorChange(toRgba(r, g, b, a));
    onClose();
  }, [r, g, b, a, onColorChange, onClose]);

  const handleHexChange = useCallback((hex: string) => {
    const parsed = parseRgba(hex);
    setR(parsed.r);
    setG(parsed.g);
    setB(parsed.b);
  }, []);

  const previewColor = toRgba(r, g, b, a);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 w-64 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-neutral-200">Custom Color</h3>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Color preview */}
        <div
          className="w-full h-16 rounded-lg mb-4 border border-neutral-700"
          style={{ backgroundColor: previewColor }}
        />

        {/* Hex input */}
        <div className="mb-4">
          <label className="block text-xs text-neutral-500 mb-1">Hex</label>
          <input
            type="color"
            value={toHex(r, g, b)}
            onChange={(e) => handleHexChange(e.target.value)}
            className="w-full h-10 rounded cursor-pointer bg-neutral-800 border border-neutral-700"
          />
        </div>

        {/* RGB sliders */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="flex justify-between text-xs text-neutral-500 mb-1">
              <span>Red</span>
              <span>{r}</span>
            </label>
            <input
              type="range"
              min="0"
              max="255"
              value={r}
              onChange={(e) => setR(parseInt(e.target.value, 10))}
              className="w-full h-2 rounded-lg appearance-none bg-gradient-to-r from-black to-red-500 cursor-pointer"
            />
          </div>
          <div>
            <label className="flex justify-between text-xs text-neutral-500 mb-1">
              <span>Green</span>
              <span>{g}</span>
            </label>
            <input
              type="range"
              min="0"
              max="255"
              value={g}
              onChange={(e) => setG(parseInt(e.target.value, 10))}
              className="w-full h-2 rounded-lg appearance-none bg-gradient-to-r from-black to-green-500 cursor-pointer"
            />
          </div>
          <div>
            <label className="flex justify-between text-xs text-neutral-500 mb-1">
              <span>Blue</span>
              <span>{b}</span>
            </label>
            <input
              type="range"
              min="0"
              max="255"
              value={b}
              onChange={(e) => setB(parseInt(e.target.value, 10))}
              className="w-full h-2 rounded-lg appearance-none bg-gradient-to-r from-black to-blue-500 cursor-pointer"
            />
          </div>
          <div>
            <label className="flex justify-between text-xs text-neutral-500 mb-1">
              <span>Alpha</span>
              <span>{a.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={a}
              onChange={(e) => setA(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none bg-gradient-to-r from-transparent to-white cursor-pointer"
              style={{
                background: `linear-gradient(to right, transparent, ${toRgba(r, g, b, 1)})`,
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm bg-neutral-800 text-neutral-400 hover:bg-neutral-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-3 py-2 text-sm bg-rose-500 text-white hover:bg-rose-600 rounded-lg transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
