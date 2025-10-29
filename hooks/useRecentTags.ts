import { useCallback, useMemo } from 'react';
import type { Tag } from '../types/supabase';

const MAX_RECENT_TAGS = 20;

interface UseRecentTagsReturn {
  recentTagIds: string[];
  recordTagUse: (tagId: string) => void;
  getAvailableRecentTags: (allTags: Tag[], excludeTagIds: string[], limit: number) => Tag[];
}

/**
 * Hook to track recently used tags per group
 * Stores up to 20 most recently used tags in localStorage (keyed by group_id)
 * Provides filtering to exclude already-applied tags when generating pie menu
 */
export const useRecentTags = (groupId: string | null): UseRecentTagsReturn => {
  const storageKey = useMemo(() =>
    groupId ? `recent_tags_${groupId}` : null,
    [groupId]
  );

  // Load recent tag IDs from localStorage
  const recentTagIds = useMemo(() => {
    if (!storageKey) return [];

    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to load recent tags:', error);
      return [];
    }
  }, [storageKey]);

  // Record a tag use (move to front of list, limit to MAX_RECENT_TAGS)
  const recordTagUse = useCallback((tagId: string) => {
    if (!storageKey) return;

    try {
      const stored = localStorage.getItem(storageKey);
      let recent: string[] = stored ? JSON.parse(stored) : [];

      // Remove tag if already in list
      recent = recent.filter(id => id !== tagId);

      // Add to front
      recent.unshift(tagId);

      // Limit to MAX_RECENT_TAGS
      recent = recent.slice(0, MAX_RECENT_TAGS);

      localStorage.setItem(storageKey, JSON.stringify(recent));
    } catch (error) {
      console.error('Failed to save recent tag:', error);
    }
  }, [storageKey]);

  // Get available recent tags (filter out excluded tags, limit results)
  // Falls back to recently created tags when localStorage is empty or has fewer than limit
  const getAvailableRecentTags = useCallback((
    allTags: Tag[],
    excludeTagIds: string[],
    limit: number
  ): Tag[] => {
    if (!storageKey) return [];

    // Create a Set for O(1) lookup
    const excludeSet = new Set(excludeTagIds);

    // Create a Map of tag ID to tag object for quick lookup
    const tagMap = new Map(allTags.map(tag => [tag.id, tag]));

    // Step 1: Get available tags from recent history (localStorage)
    const available: Tag[] = [];
    for (const tagId of recentTagIds) {
      if (excludeSet.has(tagId)) continue;

      const tag = tagMap.get(tagId);
      if (tag) {
        available.push(tag);
      }

      if (available.length >= limit) break;
    }

    // Step 2: If we have fewer than limit, fill with recently created tags
    if (available.length < limit) {
      // Create Set of tag IDs already in result
      const usedTagIds = new Set(available.map(t => t.id));

      // Sort all tags by created_at descending (most recent first)
      const sortedByCreation = [...allTags].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Add tags that aren't already used or excluded
      for (const tag of sortedByCreation) {
        if (usedTagIds.has(tag.id) || excludeSet.has(tag.id)) continue;

        available.push(tag);
        if (available.length >= limit) break;
      }
    }

    return available;
  }, [storageKey, recentTagIds]);

  return {
    recentTagIds,
    recordTagUse,
    getAvailableRecentTags
  };
};
