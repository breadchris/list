/**
 * URL Handler Configuration
 *
 * This file defines rules for how different URL patterns should be handled
 * in the application. Rules are evaluated in order, and the first matching
 * rule is used.
 */

export interface UrlHandlerRule {
  /** Human-readable name for this rule */
  name: string;

  /** Regex pattern to match URLs */
  pattern: RegExp;

  /** Actions to enable/disable for matching URLs */
  actions: {
    /** Enable/disable automatic screenshot generation */
    screenshot?: boolean;

    /** Enable/disable SEO metadata extraction */
    metadata?: boolean;

    /** Custom Lambda actions to run for this URL type */
    customActions?: string[];
  };
}

/**
 * URL Handler Rules
 *
 * Rules are evaluated in order from top to bottom.
 * The first matching rule wins, so put more specific rules first.
 * Always end with a catch-all default rule.
 */
const URL_HANDLER_RULES: UrlHandlerRule[] = [
  // YouTube - Disable screenshots and metadata, use custom extractors
  {
    name: 'YouTube',
    pattern: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i,
    actions: {
      screenshot: false,
      metadata: false,
      customActions: ['youtube-playlist-extract', 'youtube-subtitle-extract']
    }
  },

  // Default - Enable screenshots and metadata for all other URLs
  {
    name: 'Default',
    pattern: /.*/,
    actions: {
      screenshot: true,
      metadata: true,
      customActions: []
    }
  }
];

/**
 * Get the URL handler configuration for a given URL
 * @param url The URL to check
 * @returns The matching URL handler rule
 */
export function getUrlHandlerConfig(url: string): UrlHandlerRule {
  for (const rule of URL_HANDLER_RULES) {
    if (rule.pattern.test(url)) {
      return rule;
    }
  }
  // Fallback to default (should never happen if default rule exists)
  return URL_HANDLER_RULES[URL_HANDLER_RULES.length - 1];
}

/**
 * Check if screenshots should be generated for a URL
 * @param url The URL to check
 * @returns true if screenshots should be generated
 */
export function shouldGenerateScreenshot(url: string): boolean {
  const config = getUrlHandlerConfig(url);
  return config.actions.screenshot ?? true;
}

/**
 * Check if metadata should be extracted for a URL
 * @param url The URL to check
 * @returns true if metadata should be extracted
 */
export function shouldExtractMetadata(url: string): boolean {
  const config = getUrlHandlerConfig(url);
  return config.actions.metadata ?? true;
}

/**
 * Get custom Lambda actions to run for a URL
 * @param url The URL to check
 * @returns Array of custom action names
 */
export function getCustomActions(url: string): string[] {
  const config = getUrlHandlerConfig(url);
  return config.actions.customActions ?? [];
}
