"use client";

import { CodeVersionSelector } from "./code-version-selector";
import { CodePreviewRenderer } from "./code-preview-renderer";
import type { TsxVersion } from "@/components/code/types";

interface CodePreviewPanelProps {
  versions: TsxVersion[];
  selectedIndex: number;
  onSelectVersion: (index: number) => void;
  /** Hide the header on mobile (parent provides its own) */
  hideMobileHeader?: boolean;
}

export function CodePreviewPanel({
  versions,
  selectedIndex,
  onSelectVersion,
  hideMobileHeader = false,
}: CodePreviewPanelProps) {
  const selectedVersion = versions[selectedIndex] ?? null;

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Header with version selector - hidden on mobile when parent provides header */}
      <div className={`${hideMobileHeader ? 'hidden md:flex' : 'flex'} items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/50`}>
        <h2 className="text-sm font-medium text-neutral-300">Preview</h2>
        {versions.length > 0 && (
          <CodeVersionSelector
            versions={versions}
            selectedIndex={selectedIndex}
            onSelect={onSelectVersion}
          />
        )}
      </div>

      {/* Preview renderer */}
      <div className="flex-1 overflow-hidden">
        <CodePreviewRenderer version={selectedVersion} />
      </div>
    </div>
  );
}
