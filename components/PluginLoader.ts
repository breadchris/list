/**
 * Plugin Loader - Figma-Widget-Inspired Plugin System
 *
 * Loads and validates plugins written in TSX.
 * Plugins are simple declarative components that receive context (Supabase, contentId, groupId).
 */

import { TsxComponentLoader } from './TsxComponentLoader';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReactElement } from 'react';

/**
 * Plugin Context - Provides access to Supabase and content information
 * This interface can be extended over time with more functionality
 */
export interface PluginContext {
  supabase: SupabaseClient;
  contentId: string;
  groupId: string;
}

/**
 * Plugin Interface - Figma-widget-inspired structure
 * Simple to write, extensible over time
 */
export interface Plugin {
  name: string;
  render: (context: PluginContext) => ReactElement;
}

/**
 * Loaded Plugin - Contains the plugin and cleanup URL
 */
export interface LoadedPlugin {
  plugin: Plugin;
  blobUrl: string;
}

/**
 * Plugin Loader - Transpiles and loads plugin code
 */
export class PluginLoader {
  /**
   * Load a plugin from TSX source code
   */
  static async loadPlugin(pluginSource: string, filename: string = 'plugin.tsx'): Promise<LoadedPlugin> {
    try {
      // Transpile the plugin code
      const compiledJS = await TsxComponentLoader.transpile(pluginSource, filename);

      // Create blob URL for dynamic import
      const blob = new Blob([compiledJS], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      // Dynamically import the plugin
      const module = await import(/* @vite-ignore */ blobUrl);

      // Validate plugin structure
      const plugin = module.default as Plugin;
      this.validatePlugin(plugin);

      return { plugin, blobUrl };
    } catch (error) {
      console.error('Failed to load plugin:', error);
      throw new Error(`Plugin loading failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate that loaded module is a valid plugin
   */
  private static validatePlugin(plugin: any): asserts plugin is Plugin {
    if (!plugin) {
      throw new Error('Plugin must have a default export');
    }

    if (typeof plugin !== 'object') {
      throw new Error('Plugin must be an object');
    }

    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('Plugin must have a "name" property (string)');
    }

    if (!plugin.render || typeof plugin.render !== 'function') {
      throw new Error('Plugin must have a "render" property (function)');
    }
  }

  /**
   * Cleanup blob URL when plugin is no longer needed
   */
  static cleanup(blobUrl: string): void {
    URL.revokeObjectURL(blobUrl);
  }

  /**
   * Default plugin template for quick start
   */
  static getDefaultTemplate(): string {
    return `// Access React from global window object
const React = window.React;

const plugin = {
  name: 'My Plugin',
  render: ({ supabase, contentId, groupId }) => {
    const [count, setCount] = React.useState(0);

    const createChild = async () => {
      try {
        const { data, error } = await supabase
          .from('content')
          .insert({
            type: 'text',
            data: \`Child item #\${count + 1} from plugin\`,
            parent_content_id: contentId,
            group_id: groupId
          })
          .select()
          .single();

        if (error) throw error;

        console.log('Created child:', data);
        setCount(count + 1);
      } catch (error) {
        console.error('Failed to create child:', error);
        alert('Failed to create child: ' + error.message);
      }
    };

    return (
      <div style={{ padding: '1rem' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.125rem', fontWeight: '600' }}>
          My Plugin
        </h3>
        <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
          This is an example plugin. Click the button to create a child content item.
        </p>
        <button
          onClick={createChild}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Create Child (Created: {count})
        </button>
      </div>
    );
  }
};

export default plugin;
`;
  }
}
