"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { ChevronUp, Sparkles, Loader2 } from "lucide-react";
import { useAIDraw } from "../hooks/use-ai-draw";

interface AIDrawPanelProps {
  onClose: () => void;
}

export function AIDrawPanel({ onClose }: AIDrawPanelProps) {
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { draw, cancel, isDrawing, isLoading, progress, thinking, error } =
    useAIDraw({
      pixelDelay: 30,
      onComplete: () => {
        // Keep panel open to allow another prompt
      },
      onError: (err) => {
        console.error("AI Draw error:", err);
      },
    });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || isDrawing) return;
      draw(prompt.trim());
    },
    [prompt, isDrawing, draw]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
      if (e.key === "Escape") {
        if (isDrawing) {
          cancel();
        } else {
          onClose();
        }
      }
    },
    [handleSubmit, isDrawing, cancel, onClose]
  );

  const isWorking = isDrawing || isLoading;

  return (
    <div className="bg-neutral-800/50 rounded-lg border border-neutral-700">
      {/* Header */}
      <button
        onClick={onClose}
        className="w-full flex items-center justify-between p-2 text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        <span className="text-xs font-medium">AI Draw</span>
        <ChevronUp className="w-3 h-3" />
      </button>

      {/* Content */}
      <form onSubmit={handleSubmit} className="px-2 pb-2 space-y-2">
        <textarea
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what to draw..."
          className="w-full h-16 px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-200 placeholder:text-neutral-600 resize-none focus:outline-none focus:border-purple-500 transition-colors"
          disabled={isWorking}
        />

        {thinking && (
          <div className="text-[10px] text-neutral-500 italic truncate">
            {thinking}
          </div>
        )}

        {isWorking && progress.total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-neutral-500">
              <span>Drawing</span>
              <span>
                {progress.current}/{progress.total}
              </span>
            </div>
            <div className="h-1 bg-neutral-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-100"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {isLoading && progress.total === 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Generating...</span>
          </div>
        )}

        {error && (
          <div className="text-[10px] text-red-400 bg-red-400/10 p-1.5 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-1.5">
          {isWorking ? (
            <button
              type="button"
              onClick={cancel}
              className="flex-1 px-2 py-1.5 text-xs bg-neutral-700 text-neutral-300 hover:bg-neutral-600 rounded transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-purple-600 text-white hover:bg-purple-500 disabled:bg-neutral-700 disabled:text-neutral-500 rounded transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              Draw
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
