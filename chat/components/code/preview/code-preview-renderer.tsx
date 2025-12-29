"use client";

import { useState } from "react";
import { TsxIframeRenderer } from "@/components/list/TsxIframeRenderer";
import { Code2, Eye, EyeOff, AlertCircle, Maximize2 } from "lucide-react";
import type { TsxVersion } from "@/components/code/types";

interface CodePreviewRendererProps {
  version: TsxVersion | null;
}

export function CodePreviewRenderer({ version }: CodePreviewRendererProps) {
  const [showCode, setShowCode] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  if (!version) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-8">
        <div className="w-16 h-16 rounded-2xl bg-neutral-800/50 flex items-center justify-center mb-4">
          <Eye className="w-8 h-8 text-neutral-600" />
        </div>
        <h3 className="text-lg font-medium text-neutral-400 mb-2">
          Preview
        </h3>
        <p className="text-center text-sm max-w-md">
          Component preview will appear here once Claude generates TSX code.
        </p>
      </div>
    );
  }

  // Check for transpilation error
  if (version.error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-red-900/20 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-medium text-red-400 mb-2">
            Transpilation Error
          </h3>
          <p className="text-center text-sm text-red-300 max-w-md mb-4">
            {version.error}
          </p>
          <button
            onClick={() => setShowCode(true)}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View source code
          </button>
        </div>

        {showCode && (
          <div className="border-t border-neutral-800">
            <CodeViewer code={version.tsx_code} onClose={() => setShowCode(false)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-900/50">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-neutral-400" />
          <span className="text-sm text-neutral-300">{version.filename}</span>
        </div>
        <button
          onClick={() => setShowCode(!showCode)}
          className="flex items-center gap-2 px-2 py-1 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
        >
          {showCode ? (
            <>
              <EyeOff className="w-4 h-4" />
              Hide Code
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Show Code
            </>
          )}
        </button>
      </div>

      {/* Code panel (collapsible) */}
      {showCode && (
        <CodeViewer code={version.tsx_code} onClose={() => setShowCode(false)} />
      )}

      {/* Render error display */}
      {renderError && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-800/50 text-red-400 text-sm">
          Render error: {renderError}
        </div>
      )}

      {/* Preview */}
      <div className="flex-1 overflow-auto bg-white">
        <TsxIframeRenderer
          compiledJS={version.compiled_js}
          filename={version.filename}
          componentProps={{}}
          onError={(error) => setRenderError(error.message)}
          onLoad={() => setRenderError(null)}
          minHeight={200}
          maxHeight={2000}
        />
      </div>
    </div>
  );
}

// Code viewer component
function CodeViewer({ code, onClose }: { code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-h-64 overflow-auto bg-neutral-900 border-b border-neutral-800">
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-800 border-b border-neutral-700 sticky top-0">
        <span className="text-xs text-neutral-400 font-mono">TSX Source</span>
        <button
          onClick={handleCopy}
          className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="p-3 text-sm font-mono text-neutral-300 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}
