"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useYDoc } from "@y-sweet/react";
import type { WikiAIScratch } from "@/types/wiki";
import { DEFAULT_TEMPLATE_MODEL } from "@/types/wiki";

interface UseWikiAIScratchOptions {
  wiki_id: string;
}

interface UseWikiAIScratchReturn {
  /** All AI scratch sessions in the wiki */
  scratches: Map<string, WikiAIScratch>;
  /** Scratches as array for easy iteration */
  scratchesList: WikiAIScratch[];
  /** Whether Y.js doc is ready */
  isReady: boolean;
  /** Get a scratch by ID */
  getScratch: (id: string) => WikiAIScratch | undefined;
  /** Create a new AI scratch session */
  createScratch: () => WikiAIScratch;
  /** Update a scratch (e.g., change model) */
  updateScratch: (scratchId: string, updates: { model?: string }) => void;
  /** Delete a scratch */
  deleteScratch: (scratchId: string) => void;
}

/**
 * Hook for managing AI scratch sessions
 *
 * All state is stored in Y.js Y.Map('wiki-ai-scratch').
 * Persisted via Y.js (IndexedDB + Y-Sweet).
 */
export function useWikiAIScratch({
  wiki_id,
}: UseWikiAIScratchOptions): UseWikiAIScratchReturn {
  const doc = useYDoc();

  // Scratches state (derived from Y.js)
  const [scratches, setScratches] = useState<Map<string, WikiAIScratch>>(
    new Map()
  );

  // Y.js map for scratches
  const scratchesMap = useMemo(() => {
    if (!doc) return null;
    return doc.getMap<WikiAIScratch>("wiki-ai-scratch");
  }, [doc]);

  // Sync scratches from Y.js map to React state
  useEffect(() => {
    if (!scratchesMap) return;

    const syncFromYjs = () => {
      const newScratches = new Map<string, WikiAIScratch>();
      scratchesMap.forEach((scratch, id) => {
        newScratches.set(id, scratch);
      });
      setScratches(newScratches);
    };

    // Initial sync
    syncFromYjs();

    // Listen for changes
    scratchesMap.observe(syncFromYjs);
    return () => scratchesMap.unobserve(syncFromYjs);
  }, [scratchesMap]);

  // Convert to array for easy iteration (sorted by creation time, newest first)
  const scratchesList = useMemo(() => {
    return Array.from(scratches.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [scratches]);

  // Get scratch by ID
  const getScratch = useCallback(
    (id: string): WikiAIScratch | undefined => {
      return scratches.get(id);
    },
    [scratches]
  );

  // Create a new AI scratch session
  const createScratch = useCallback((): WikiAIScratch => {
    if (!scratchesMap) {
      throw new Error("Y.js document not ready");
    }

    const scratchId = crypto.randomUUID();

    const newScratch: WikiAIScratch = {
      id: scratchId,
      wiki_id,
      model: DEFAULT_TEMPLATE_MODEL,
      created_at: new Date().toISOString(),
    };

    // Add to Y.js map (this triggers the observer and updates React state)
    scratchesMap.set(scratchId, newScratch);

    return newScratch;
  }, [wiki_id, scratchesMap]);

  // Update a scratch
  const updateScratch = useCallback(
    (scratchId: string, updates: { model?: string }): void => {
      if (!scratchesMap) {
        throw new Error("Y.js document not ready");
      }

      const existing = scratchesMap.get(scratchId);
      if (!existing) {
        throw new Error("Scratch not found");
      }

      // Update in Y.js
      scratchesMap.set(scratchId, {
        ...existing,
        model: updates.model ?? existing.model,
      });
    },
    [scratchesMap]
  );

  // Delete a scratch
  const deleteScratch = useCallback(
    (scratchId: string): void => {
      if (!scratchesMap) {
        throw new Error("Y.js document not ready");
      }

      if (!scratchesMap.has(scratchId)) {
        throw new Error("Scratch not found");
      }

      // Delete from Y.js map
      scratchesMap.delete(scratchId);
    },
    [scratchesMap]
  );

  return {
    scratches,
    scratchesList,
    isReady: !!doc,
    getScratch,
    createScratch,
    updateScratch,
    deleteScratch,
  };
}
