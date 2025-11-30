"use client";

import React, { useMemo, useState } from "react";
import { transform } from "sucrase";

interface CodeVariant {
  name: string;
  code: string;
}

interface CodeRendererProps {
  variant: CodeVariant;
}

/**
 * Renders a React TSX component from a code string using Sucrase for transpilation.
 * Includes error boundary for catching render errors.
 */
export function CodeRenderer({ variant }: CodeRendererProps) {
  const [showCode, setShowCode] = useState(false);

  const { Component, error } = useMemo(() => {
    try {
      // Transpile TSX to JS using Sucrase
      const result = transform(variant.code, {
        transforms: ["typescript", "jsx"],
        jsxRuntime: "classic",
        production: true,
      });

      // Create a function that returns the component
      // The code should define a "Component" function
      const componentCode = `
        ${result.code}
        return typeof Component !== 'undefined' ? Component : null;
      `;

      // Create and execute the function with React in scope
      const createComponent = new Function("React", componentCode);
      const ComponentFn = createComponent(React);

      if (!ComponentFn) {
        return {
          Component: null,
          error: "No Component function found in code",
        };
      }

      return { Component: ComponentFn, error: null };
    } catch (err) {
      return {
        Component: null,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }, [variant.code]);

  return (
    <div className="my-2 rounded-lg border border-neutral-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-800 border-b border-neutral-700">
        <span className="text-sm font-medium text-neutral-300">
          {variant.name}
        </span>
        <button
          onClick={() => setShowCode(!showCode)}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          {showCode ? "Hide Code" : "Show Code"}
        </button>
      </div>

      {/* Code panel (collapsible) */}
      {showCode && (
        <div className="bg-neutral-900 border-b border-neutral-700 overflow-x-auto">
          <pre className="p-3 text-xs text-neutral-400 font-mono whitespace-pre-wrap">
            {variant.code}
          </pre>
        </div>
      )}

      {/* Rendered component */}
      <div className="p-4 ">
        {error ? (
          <div className="text-red-500 text-sm font-mono p-2 bg-red-50 rounded">
            Error: {error}
          </div>
        ) : Component ? (
          <ErrorBoundary>
            <Component />
          </ErrorBoundary>
        ) : (
          <div className="text-neutral-500 text-sm">No component to render</div>
        )}
      </div>
    </div>
  );
}

/**
 * Error boundary to catch runtime errors in rendered components
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-500 text-sm font-mono p-2 bg-red-50 rounded">
          Runtime Error: {this.state.error}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Helper to parse code variant from message content
 */
export function parseCodeVariant(content: string): CodeVariant | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.name && parsed.code) {
      return parsed as CodeVariant;
    }
    return null;
  } catch {
    return null;
  }
}
