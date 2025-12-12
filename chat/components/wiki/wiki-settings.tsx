"use client";

import { X } from "lucide-react";
import type { WikiNavMode } from "@/types/wiki";

interface WikiSettingsProps {
  /** Current navigation mode */
  navMode: WikiNavMode;
  /** Callback to change navigation mode */
  onNavModeChange: (mode: WikiNavMode) => void;
  /** Close the settings panel */
  onClose: () => void;
}

export function WikiSettings({
  navMode,
  onNavModeChange,
  onClose,
}: WikiSettingsProps) {
  return (
    <div className="w-80 h-full flex flex-col bg-neutral-900 border-l border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h2 className="text-neutral-200 font-medium">Settings</h2>
        <button
          onClick={onClose}
          className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
          title="Close settings"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Navigation Mode */}
        <div>
          <h3 className="text-neutral-200 font-medium text-sm mb-3">
            Link Navigation
          </h3>
          <p className="text-neutral-500 text-xs mb-4">
            Choose how clicking links in the wiki should behave.
          </p>

          <div className="space-y-3">
            {/* Option: Always new panel */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                navMode === "new-panel"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-neutral-700 hover:border-neutral-600"
              }`}
            >
              <input
                type="radio"
                name="navMode"
                value="new-panel"
                checked={navMode === "new-panel"}
                onChange={() => onNavModeChange("new-panel")}
                className="mt-1"
              />
              <div>
                <div className="text-neutral-200 text-sm font-medium">
                  Always open new panel
                </div>
                <div className="text-neutral-500 text-xs mt-1">
                  Clicking any link opens a new panel to the right, building a
                  navigation trail.
                </div>
              </div>
            </label>

            {/* Option: Replace with modifier */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                navMode === "replace-with-modifier"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-neutral-700 hover:border-neutral-600"
              }`}
            >
              <input
                type="radio"
                name="navMode"
                value="replace-with-modifier"
                checked={navMode === "replace-with-modifier"}
                onChange={() => onNavModeChange("replace-with-modifier")}
                className="mt-1"
              />
              <div>
                <div className="text-neutral-200 text-sm font-medium">
                  Replace panel (modifier for new)
                </div>
                <div className="text-neutral-500 text-xs mt-1">
                  Click replaces the current panel. Hold{" "}
                  <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">
                    {typeof navigator !== "undefined" &&
                    navigator.platform.includes("Mac")
                      ? "⌘"
                      : "Ctrl"}
                  </kbd>{" "}
                  while clicking to open in a new panel.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div>
          <h3 className="text-neutral-200 font-medium text-sm mb-3">
            Keyboard Shortcuts
          </h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-400">Close panel</span>
              <kbd className="px-2 py-0.5 bg-neutral-800 rounded text-neutral-300 text-xs">
                Esc
              </kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Toggle sidebar</span>
              <kbd className="px-2 py-0.5 bg-neutral-800 rounded text-neutral-300 text-xs">
                {typeof navigator !== "undefined" &&
                navigator.platform.includes("Mac")
                  ? "⌘"
                  : "Ctrl"}{" "}
                + B
              </kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">New page</span>
              <kbd className="px-2 py-0.5 bg-neutral-800 rounded text-neutral-300 text-xs">
                {typeof navigator !== "undefined" &&
                navigator.platform.includes("Mac")
                  ? "⌘"
                  : "Ctrl"}{" "}
                + N
              </kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Search pages</span>
              <kbd className="px-2 py-0.5 bg-neutral-800 rounded text-neutral-300 text-xs">
                {typeof navigator !== "undefined" &&
                navigator.platform.includes("Mac")
                  ? "⌘"
                  : "Ctrl"}{" "}
                + K
              </kbd>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="pt-4 border-t border-neutral-800">
          <h3 className="text-neutral-200 font-medium text-sm mb-2">About</h3>
          <p className="text-neutral-500 text-xs">
            Wiki Builder is a collaborative wiki interface with multi-panel
            navigation. Create links using{" "}
            <code className="px-1 py-0.5 bg-neutral-800 rounded">
              [[Page Name]]
            </code>{" "}
            syntax or standard markdown links.
          </p>
        </div>
      </div>
    </div>
  );
}
