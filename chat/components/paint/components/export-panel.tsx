"use client";

import React, { useState, useCallback } from "react";
import { Copy, Download, Check, Code } from "lucide-react";
import { useCssGenerationData, useExportData } from "../hooks/use-paint-state";
import { generateCss } from "../utils/css-generator";

export function ExportPanel() {
  const cssData = useCssGenerationData();
  const exportData = useExportData();
  const [copied, setCopied] = useState(false);
  const [showCss, setShowCss] = useState(false);

  const css = generateCss(cssData);

  const handleCopyCss = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy CSS:", err);
    }
  }, [css]);

  const handleDownloadPng = useCallback(() => {
    // Create a canvas to render the pixel art
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { columns, rows, cell_size } = cssData;
    const grid = cssData.grid;

    canvas.width = columns * cell_size;
    canvas.height = rows * cell_size;

    // Fill with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each pixel
    for (let i = 0; i < grid.length; i++) {
      const color = grid[i];
      if (color && color !== "") {
        const x = (i % columns) * cell_size;
        const y = Math.floor(i / columns) * cell_size;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, cell_size, cell_size);
      }
    }

    // Download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pixel-art.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [cssData]);

  const handleDownloadJson = useCallback(() => {
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pixel-art.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [exportData]);

  return (
    <div className="space-y-3">
      <div className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
        Export
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={handleCopyCss}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy CSS</span>
            </>
          )}
        </button>

        <button
          onClick={handleDownloadPng}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download PNG</span>
        </button>

        <button
          onClick={handleDownloadJson}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download JSON</span>
        </button>

        <button
          onClick={() => setShowCss(!showCss)}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition-colors"
        >
          <Code className="w-3.5 h-3.5" />
          <span>{showCss ? "Hide" : "View"} CSS</span>
        </button>
      </div>

      {showCss && (
        <div className="p-2 bg-neutral-950 rounded-lg border border-neutral-800 max-h-40 overflow-auto">
          <pre className="text-[10px] text-neutral-400 whitespace-pre-wrap break-all">
            {css}
          </pre>
        </div>
      )}
    </div>
  );
}
