/**
 * Feature Flags System
 *
 * Manages experimental features using localStorage.
 * All flags default to false (disabled).
 */

// Feature flag keys
export type FeatureFlagKey =
  | 'enableQueryCaching'
  | 'enableExperimentalFeatures'
  | 'enableDebugMode';

// Default values - all disabled by default
const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  enableQueryCaching: false,
  enableExperimentalFeatures: false,
  enableDebugMode: false,
};

// Feature flag metadata for UI display
export const FEATURE_FLAG_METADATA: Record<FeatureFlagKey, { label: string; description: string }> = {
  enableQueryCaching: {
    label: 'Enable Query Caching',
    description: 'Cache content queries and show cached data while fetching fresh data in the background',
  },
  enableExperimentalFeatures: {
    label: 'Enable Experimental Features',
    description: 'Access bleeding-edge features that are still in development',
  },
  enableDebugMode: {
    label: 'Enable Debug Mode',
    description: 'Show additional debugging information in the console',
  },
};

/**
 * Get a feature flag value from localStorage
 * Returns default value if not set
 */
export function getFeatureFlag(key: FeatureFlagKey): boolean {
  try {
    const stored = localStorage.getItem(`featureFlag_${key}`);
    if (stored === null) {
      return FEATURE_FLAG_DEFAULTS[key];
    }
    return stored === 'true';
  } catch (error) {
    console.error(`Failed to get feature flag ${key}:`, error);
    return FEATURE_FLAG_DEFAULTS[key];
  }
}

/**
 * Set a feature flag value in localStorage
 */
export function setFeatureFlag(key: FeatureFlagKey, value: boolean): void {
  try {
    localStorage.setItem(`featureFlag_${key}`, value.toString());
  } catch (error) {
    console.error(`Failed to set feature flag ${key}:`, error);
  }
}

/**
 * Get all feature flags as an object
 */
export function getAllFeatureFlags(): Record<FeatureFlagKey, boolean> {
  const flags = {} as Record<FeatureFlagKey, boolean>;
  const keys = Object.keys(FEATURE_FLAG_DEFAULTS) as FeatureFlagKey[];

  keys.forEach((key) => {
    flags[key] = getFeatureFlag(key);
  });

  return flags;
}

/**
 * Reset all feature flags to their default values
 */
export function resetAllFeatureFlags(): void {
  const keys = Object.keys(FEATURE_FLAG_DEFAULTS) as FeatureFlagKey[];
  keys.forEach((key) => {
    setFeatureFlag(key, FEATURE_FLAG_DEFAULTS[key]);
  });
}
