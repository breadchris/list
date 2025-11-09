import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getFeatureFlag,
  setFeatureFlag,
  getAllFeatureFlags,
  FeatureFlagKey,
  FEATURE_FLAG_METADATA,
} from '../utils/featureFlags';

/**
 * React hook for managing feature flags
 *
 * Features:
 * - Reads/writes to localStorage
 * - Triggers re-render when flags change
 * - Clears React Query cache when disabling query caching
 */
export function useFeatureFlags() {
  const queryClient = useQueryClient();
  const [flags, setFlags] = useState<Record<FeatureFlagKey, boolean>>(getAllFeatureFlags());

  /**
   * Toggle a feature flag on/off
   * Special handling for enableQueryCaching: clears cache when disabled
   */
  const toggleFlag = useCallback(
    (key: FeatureFlagKey) => {
      const newValue = !flags[key];

      // Special handling: clear React Query cache when disabling query caching
      if (key === 'enableQueryCaching' && !newValue) {
        console.log('[Feature Flags] Query caching disabled - clearing React Query cache');
        queryClient.clear();
      }

      // Update localStorage
      setFeatureFlag(key, newValue);

      // Update state to trigger re-render
      setFlags((prev) => ({ ...prev, [key]: newValue }));

      console.log(`[Feature Flags] ${key} = ${newValue}`);
    },
    [flags, queryClient]
  );

  /**
   * Get a single feature flag value
   */
  const getFlag = useCallback((key: FeatureFlagKey): boolean => {
    return flags[key];
  }, [flags]);

  return {
    flags,
    toggleFlag,
    getFlag,
    metadata: FEATURE_FLAG_METADATA,
  };
}
