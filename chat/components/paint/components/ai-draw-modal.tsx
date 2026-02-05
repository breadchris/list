"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { useAIDraw } from "../hooks/use-ai-draw";

interface AIDrawModalProps {
  onClose: () => void;
}

export function AIDrawModal({ onClose }: AIDrawModalProps) {
  const [prompt, setPrompt] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { draw, cancel, isDrawing, isLoading, progress, thinking, error } =
    useAIDraw({
      pixelDelay: 30, // 30ms between pixels for smooth animation
      onComplete: () => {
        // Keep modal open to show completion
      },
      onError: (err) => {
        console.error("AI Draw error:", err);
      },
    });

  // Focus input on mount
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-80 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-medium text-neutral-200">AI Draw</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
            disabled={isWorking}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Prompt input */}
          <div>
            <label className="block text-xs text-neutral-500 mb-2">
              Describe what to draw
            </label>
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., a red heart, a simple tree, a smiley face..."
              className="w-full h-20 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder:text-neutral-600 resize-none focus:outline-none focus:border-purple-500 transition-colors"
              disabled={isWorking}
            />
          </div>

          {/* Thinking indicator */}
          {thinking && (
            <div className="text-xs text-neutral-400 italic">{thinking}</div>
          )}

          {/* Progress indicator */}
          {isWorking && progress.total > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Drawing...</span>
                <span>
                  {progress.current} / {progress.total} pixels
                </span>
              </div>
              <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-100"
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Loading indicator when waiting for pixels */}
          {isLoading && progress.total === 0 && (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Generating pixel art...</span>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={isWorking ? cancel : onClose}
              className="flex-1 px-3 py-2 text-sm bg-neutral-800 text-neutral-400 hover:bg-neutral-700 rounded-lg transition-colors"
            >
              {isWorking ? "Cancel" : "Close"}
            </button>
            <button
              type="submit"
              disabled={!prompt.trim() || isWorking}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white hover:bg-purple-500 disabled:bg-neutral-700 disabled:text-neutral-500 rounded-lg transition-colors"
            >
              {isWorking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Drawing
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Draw
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
