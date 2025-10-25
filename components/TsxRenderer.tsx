/**
 * TSX Renderer Component
 *
 * Dynamically loads and renders TSX components in isolated iframes.
 * Provides security and style isolation from the parent page.
 */

import React, { useEffect, useState } from 'react';
import { TsxComponentLoader } from './TsxComponentLoader';
import { TsxIframeRenderer } from './TsxIframeRenderer';
import { ContentRepository, SerializedContent } from './ContentRepository';

interface TsxRendererProps {
  tsxSource: string;
  filename?: string;
  componentProps?: Record<string, any>;
  contentId?: string; // Optional ID of TSX content to fetch input_content_ids from metadata
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
  contentId,
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

  const [inputContent, setInputContent] = useState<SerializedContent[]>([]);
  const [inputContentLoading, setInputContentLoading] = useState(false);

  // Fetch input content from metadata effect
  useEffect(() => {
    let isMounted = true;

    const fetchInputContent = async () => {
      if (!contentId) {
        setInputContent([]);
        return;
      }

      try {
        setInputContentLoading(true);
        const repository = new ContentRepository();

        // Fetch the TSX content to get its metadata
        const tsxContent = await repository.getContentById(contentId);

        if (!tsxContent || !tsxContent.metadata?.input_content_ids) {
          if (isMounted) {
            setInputContent([]);
            setInputContentLoading(false);
          }
          return;
        }

        const inputContentIds = tsxContent.metadata.input_content_ids as string[];

        // Serialize each input content item with its children
        const serialized: SerializedContent[] = [];
        for (const inputId of inputContentIds) {
          try {
            const serializedItem = await repository.serializeContentWithChildren(inputId);
            serialized.push(serializedItem);
          } catch (error) {
            console.error(`Failed to serialize input content ${inputId}:`, error);
            // Continue with other items even if one fails
          }
        }

        if (isMounted) {
          setInputContent(serialized);
          setInputContentLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch input content:', error);
        if (isMounted) {
          setInputContent([]);
          setInputContentLoading(false);
        }
      }
    };

    fetchInputContent();

    return () => {
      isMounted = false;
    };
  }, [contentId]);

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
  if (state.loading || inputContentLoading) {
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
    // Merge input content into component props
    const mergedProps = {
      ...componentProps,
      content: inputContent
    };

    return (
      <TsxIframeRenderer
        compiledJS={state.compiledJS}
        filename={filename}
        componentProps={mergedProps}
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
