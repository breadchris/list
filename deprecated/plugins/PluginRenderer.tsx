/**
 * Plugin Renderer Component
 *
 * Renders a loaded plugin with the necessary context (Supabase client, content ID, group ID).
 * Handles errors gracefully and provides loading states.
 */

import React, { useEffect, useState, useRef } from 'react';
import { PluginLoader, type Plugin, type PluginContext } from './PluginLoader';
import { supabase } from './SupabaseClient';

export interface PluginRendererProps {
  pluginCode: string;
  contentId: string;
  groupId: string;
  onError?: (error: Error) => void;
}

/**
 * PluginRenderer - Loads and renders a plugin with context
 */
export function PluginRenderer({
  pluginCode,
  contentId,
  groupId,
  onError
}: PluginRendererProps) {
  const [plugin, setPlugin] = useState<Plugin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Load plugin on mount or when code changes
  useEffect(() => {
    let mounted = true;

    const loadPlugin = async () => {
      try {
        setLoading(true);
        setError(null);

        // Cleanup previous blob URL
        if (blobUrlRef.current) {
          PluginLoader.cleanup(blobUrlRef.current);
          blobUrlRef.current = null;
        }

        // Load the plugin
        const { plugin: loadedPlugin, blobUrl } = await PluginLoader.loadPlugin(pluginCode);

        if (!mounted) {
          PluginLoader.cleanup(blobUrl);
          return;
        }

        blobUrlRef.current = blobUrl;
        setPlugin(loadedPlugin);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;

        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Plugin loading error:', error);
        setError(error.message);
        setLoading(false);
        onError?.(error);
      }
    };

    loadPlugin();

    return () => {
      mounted = false;
      if (blobUrlRef.current) {
        PluginLoader.cleanup(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [pluginCode, onError]);

  // Prepare plugin context
  const context: PluginContext = {
    supabase,
    contentId,
    groupId
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 text-gray-600">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="text-sm">Loading plugin...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-red-800 font-semibold">Plugin Error</h3>
        </div>
        <p className="text-red-600 text-sm font-mono whitespace-pre-wrap">{error}</p>
      </div>
    );
  }

  // Render plugin
  if (!plugin) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800 text-sm">No plugin loaded</p>
      </div>
    );
  }

  // Wrap plugin render in error boundary
  try {
    const pluginElement = plugin.render(context);

    return (
      <div className="plugin-container">
        <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-blue-50 border-l-4 border-blue-500 rounded">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span className="text-xs font-medium text-blue-800 uppercase tracking-wide">
            {plugin.name}
          </span>
        </div>
        <div className="plugin-content">
          {pluginElement}
        </div>
      </div>
    );
  } catch (renderError) {
    const errorMessage = renderError instanceof Error ? renderError.message : String(renderError);
    console.error('Plugin render error:', renderError);

    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-red-800 font-semibold">Plugin Render Error</h3>
        </div>
        <p className="text-red-600 text-sm font-mono whitespace-pre-wrap">{errorMessage}</p>
      </div>
    );
  }
}
