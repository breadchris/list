/**
 * TSX Renderer Component
 *
 * Dynamically loads and renders TSX components in isolated iframes.
 * Provides security and style isolation from the parent page.
 */

import React, { useEffect, useState } from 'react';
import { TsxComponentLoader } from './TsxComponentLoader';
import { TsxIframeRenderer } from './TsxIframeRenderer';

interface TsxRendererProps {
  tsxSource: string;
  filename?: string;
  componentProps?: Record<string, any>;
  onError?: (error: Error) => void;
  onLoad?: () => void;
  fallback?: React.ReactNode;
  errorFallback?: (error: Error) => React.ReactNode;
  minHeight?: number;
  maxHeight?: number;
}

interface TsxRendererState {
  compiledJS: string | null;
  loading: boolean;
  error: Error | null;
}

/**
 * TsxRenderer - Loads and renders TSX components in isolated iframes
 */
export function TsxRenderer({
  tsxSource,
  filename = 'component.tsx',
  componentProps = {},
  onError,
  onLoad,
  fallback,
  errorFallback,
  minHeight = 100,
  maxHeight = 2000
}: TsxRendererProps) {
  const [state, setState] = useState<TsxRendererState>({
    compiledJS: null,
    loading: true,
    error: null
  });

  // Transpile component effect
  useEffect(() => {
    let isMounted = true;

    const transpileComponent = async () => {
      try {
        setState({ compiledJS: null, loading: true, error: null });

        const compiledJS = await TsxComponentLoader.transpile(tsxSource, filename);

        if (isMounted) {
          setState({ compiledJS, loading: false, error: null });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to transpile component');
        console.error('TSX transpilation error:', err);

        if (isMounted) {
          setState({ compiledJS: null, loading: false, error: err });
          onError?.(err);
        }
      }
    };

    transpileComponent();

    return () => {
      isMounted = false;
    };
  }, [tsxSource, filename, onError]);

  // Loading state
  if (state.loading) {
    return (
      <div className="flex items-center justify-center p-8">
        {fallback || (
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full"></div>
            <span>Loading component...</span>
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        {errorFallback?.(state.error) || (
          <>
            <h3 className="text-red-800 font-semibold mb-2">Failed to Load Component</h3>
            <p className="text-red-600 text-sm font-mono">{state.error.message}</p>
            <details className="mt-2">
              <summary className="text-red-700 text-sm cursor-pointer">Stack Trace</summary>
              <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-48">
                {state.error.stack}
              </pre>
            </details>
          </>
        )}
      </div>
    );
  }

  // Render compiled component in iframe
  if (state.compiledJS) {
    return (
      <TsxIframeRenderer
        compiledJS={state.compiledJS}
        filename={filename}
        componentProps={componentProps}
        onError={onError}
        onLoad={onLoad}
        minHeight={minHeight}
        maxHeight={maxHeight}
      />
    );
  }

  return null;
}

/**
 * Hook for programmatically loading TSX components
 */
export function useTsxComponent(tsxSource: string, filename?: string) {
  const [state, setState] = useState<{
    Component: React.ComponentType<any> | null;
    loading: boolean;
    error: Error | null;
  }>({
    Component: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setState({ Component: null, loading: true, error: null });

        const loaded = await TsxComponentLoader.loadComponent(tsxSource, filename);

        if (isMounted) {
          setState({ Component: loaded.Component, loading: false, error: null });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to load component');

        if (isMounted) {
          setState({ Component: null, loading: false, error: err });
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [tsxSource, filename]);

  return state;
}
