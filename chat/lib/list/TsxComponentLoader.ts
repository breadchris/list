/**
 * TSX Component Loader
 *
 * Loads and transpiles TSX components from the Lambda endpoint,
 * then dynamically imports them as ES modules for rendering.
 */

import { LambdaClient } from './LambdaClient';

export interface TranspileResult {
  success: boolean;
  compiled_js?: string;
  error?: string;
  errors?: Array<{
    message: string;
    location?: {
      file: string;
      line: number;
      column: number;
      lineText?: string;
    };
  }>;
  warnings?: Array<{
    message: string;
    location?: {
      file: string;
      line: number;
      column: number;
      lineText?: string;
    };
  }>;
}

export interface LoadedComponent {
  Component: React.ComponentType<any>;
  blobUrl: string;
  sourceHash: string;
}

export class TsxComponentLoader {
  private static cache = new Map<string, LoadedComponent>();

  /**
   * Generate a hash of the TSX source code for caching
   */
  private static async hashSource(source: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(source);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Transpile TSX source code to JavaScript
   * Returns only the compiled JS, without dynamic import
   *
   * @param tsxSource - TSX source code to transpile
   * @param filename - Optional filename for better error messages
   * @returns Promise resolving to the compiled JavaScript
   */
  static async transpile(
    tsxSource: string,
    filename: string = 'component.tsx'
  ): Promise<string> {
    console.log(`Transpiling TSX: ${filename}`);

    // Call Lambda to transpile TSX → JS
    const result = await LambdaClient.invoke({
      action: 'tsx-transpile',
      payload: {
        tsx_code: tsxSource,
        filename
      },
      sync: true
    });

    if (!result.success || !result.compiled_js) {
      const errorMsg = result.error || 'Transpilation failed';
      const errors = (result as TranspileResult).errors;

      if (errors && errors.length > 0) {
        const detailedError = errors.map(err => {
          if (err.location) {
            return `${err.message} at ${err.location.file}:${err.location.line}:${err.location.column}`;
          }
          return err.message;
        }).join('\n');
        throw new Error(`TSX transpilation failed:\n${detailedError}`);
      }

      throw new Error(errorMsg);
    }

    const compiledJS = (result as TranspileResult).compiled_js!;
    console.log(`Transpiled ${filename} (${compiledJS.length} bytes)`);

    return compiledJS;
  }

  /**
   * Load and transpile a TSX component
   *
   * @param tsxSource - TSX source code to transpile
   * @param filename - Optional filename for better error messages
   * @returns Promise resolving to the loaded React component
   */
  static async loadComponent(
    tsxSource: string,
    filename: string = 'component.tsx'
  ): Promise<LoadedComponent> {
    // Check cache first
    const sourceHash = await this.hashSource(tsxSource);
    const cached = this.cache.get(sourceHash);
    if (cached) {
      console.log(`TSX component loaded from cache: ${filename}`);
      return cached;
    }

    // Transpile the component
    const compiledJS = await this.transpile(tsxSource, filename);

    // Create a blob URL for the compiled JS module
    const blob = new Blob([compiledJS], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    try {
      // Dynamically import the module
      const module = await import(/* @vite-ignore */ blobUrl);

      if (!module.default) {
        throw new Error('TSX component must have a default export');
      }

      const loaded: LoadedComponent = {
        Component: module.default,
        blobUrl,
        sourceHash
      };

      // Cache the loaded component
      this.cache.set(sourceHash, loaded);

      console.log(`Successfully loaded TSX component: ${filename}`);
      return loaded;

    } catch (error) {
      // Clean up blob URL on error
      URL.revokeObjectURL(blobUrl);
      throw new Error(`Failed to load component: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Preload a TSX component without rendering it
   * Useful for prefetching components
   */
  static async preloadComponent(tsxSource: string, filename?: string): Promise<void> {
    await this.loadComponent(tsxSource, filename);
  }

  /**
   * Clear the component cache
   * Revokes all blob URLs to prevent memory leaks
   */
  static clearCache(): void {
    for (const [, loaded] of this.cache) {
      URL.revokeObjectURL(loaded.blobUrl);
    }
    this.cache.clear();
    console.log('TSX component cache cleared');
  }

  /**
   * Revoke a specific component's blob URL and remove from cache
   */
  static revokeComponent(sourceHash: string): void {
    const loaded = this.cache.get(sourceHash);
    if (loaded) {
      URL.revokeObjectURL(loaded.blobUrl);
      this.cache.delete(sourceHash);
      console.log(`Revoked TSX component: ${sourceHash}`);
    }
  }
}
