"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePaintInitialization } from "./hooks/use-paint-initialization";
import { usePaintState } from "./hooks/use-paint-state";
import { PixelCanvas } from "./components/pixel-canvas";
import { Toolbar } from "./components/toolbar";
import { PaletteGrid } from "./components/palette-grid";
import { FramesHandler } from "./components/frames-handler";
import { PreviewBox } from "./components/preview-box";
import { DimensionsControl } from "./components/dimensions-control";
import { DurationControl } from "./components/duration-control";
import { ExportPanel } from "./components/export-panel";
import { MobileBottomBar } from "./components/mobile-bottom-bar";
import { MobileSheet } from "./components/mobile-sheet";
import { useIsMobile } from "@/components/ui/use-mobile";
import { Loader2 } from "lucide-react";

export function PaintAppInterface() {
  usePaintInitialization();
  const { state } = usePaintState();
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Wait for state to be initialized
  useEffect(() => {
    if (state.frames.list.length > 0) {
      setIsLoading(false);
    }
  }, [state.frames.list.length]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-900">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Loading canvas...</span>
        </div>
      </div>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="h-full flex flex-col bg-neutral-900 text-neutral-100 overflow-hidden">
        {/* Frames Handler - Top Bar (compact on mobile) */}
        <div className="flex-shrink-0 border-b border-neutral-800 bg-neutral-900/50">
          <FramesHandler />
        </div>

        {/* Canvas - Full width center */}
        <div ref={canvasContainerRef} className="flex-1 flex items-center justify-center p-2 overflow-auto bg-neutral-950">
          <PixelCanvas containerRef={canvasContainerRef} />
        </div>

        {/* Mobile Bottom Bar */}
        <MobileBottomBar
          onPaletteOpen={() => setPaletteOpen(true)}
          onSettingsOpen={() => setSettingsOpen(true)}
        />

        {/* Palette Sheet */}
        <MobileSheet
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          title="Colors"
        >
          <PaletteGrid />
        </MobileSheet>

        {/* Settings Sheet */}
        <MobileSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          title="Settings"
        >
          <PreviewBox />
          <DimensionsControl />
          <DurationControl />
          <ExportPanel />
        </MobileSheet>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="h-full flex flex-col bg-neutral-900 text-neutral-100 overflow-hidden">
      {/* Frames Handler - Top Bar */}
      <div className="flex-shrink-0 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm">
        <FramesHandler />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tools & Palette */}
        <div className="w-48 flex-shrink-0 border-r border-neutral-800 p-3 flex flex-col gap-4 overflow-y-auto bg-neutral-900/50">
          <Toolbar />
          <PaletteGrid />
        </div>

        {/* Center - Canvas */}
        <div ref={canvasContainerRef} className="flex-1 flex items-center justify-center p-4 overflow-auto bg-neutral-950">
          <PixelCanvas containerRef={canvasContainerRef} />
        </div>

        {/* Right Sidebar - Preview & Settings */}
        <div className="w-52 flex-shrink-0 border-l border-neutral-800 p-3 flex flex-col gap-4 overflow-y-auto bg-neutral-900/50">
          <PreviewBox />
          <DimensionsControl />
          <DurationControl />
          <ExportPanel />
        </div>
      </div>
    </div>
  );
}
