"use client";

import React from "react";
import { Plus, Trash2, Copy } from "lucide-react";
import { useFramesHandlerState } from "../hooks/use-paint-state";
import { usePaintActions } from "../hooks/use-paint-actions";
import { Frame } from "./frame";

export function FramesHandler() {
  const { frames, active_index, columns, rows } = useFramesHandlerState();
  const { createNewFrame, deleteFrame, duplicateFrame, changeActiveFrame } =
    usePaintActions();

  const handleDeleteFrame = (index: number) => {
    if (frames.length > 1) {
      deleteFrame(index);
    }
  };

  const handleDuplicateFrame = (index: number) => {
    duplicateFrame(index);
  };

  return (
    <div className="flex items-center gap-2 p-2">
      {/* Add frame button */}
      <button
        onClick={createNewFrame}
        className="flex-shrink-0 p-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors"
        title="Add frame"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Frames list */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-1.5 py-1">
          {frames.map((frame, index) => (
            <div key={frame.key} className="relative group flex-shrink-0">
              <Frame
                frame={frame}
                index={index}
                columns={columns}
                rows={rows}
                isActive={active_index === index}
                onClick={() => changeActiveFrame(index)}
              />

              {/* Frame actions overlay */}
              <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicateFrame(index);
                  }}
                  className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300"
                  title="Duplicate frame"
                >
                  <Copy className="w-3 h-3" />
                </button>
                {frames.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFrame(index);
                    }}
                    className="p-1 bg-red-900/80 hover:bg-red-800 rounded text-red-300"
                    title="Delete frame"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Frame number */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-neutral-500 bg-neutral-900/80 px-1 rounded">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Frame count */}
      <div className="flex-shrink-0 text-xs text-neutral-500">
        {frames.length} frame{frames.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
