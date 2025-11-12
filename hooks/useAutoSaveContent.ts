import { useState, useCallback, useRef, useEffect } from 'react';
import { ContentRepository } from '../components/ContentRepository';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveContentOptions {
  contentId: string;
  debounceMs?: number;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

interface UseAutoSaveContentReturn {
  saveState: SaveState;
  save: (data: string) => void;
  forceSave: () => Promise<void>;
  error: Error | null;
}

/**
 * Hook for auto-saving content with debouncing
 *
 * Implements Google Docs-style auto-save:
 * - Debounces save operations (default 500ms)
 * - Tracks save state for UI feedback
 * - Handles errors gracefully
 *
 * @example
 * const { saveState, save } = useAutoSaveContent({
 *   contentId: '123',
 *   debounceMs: 500
 * });
 *
 * // Call on every content change
 * <Editor onChange={(content) => save(content)} />
 *
 * // Show status
 * {saveState === 'saving' && <span>Saving...</span>}
 * {saveState === 'saved' && <span>Saved ✓</span>}
 */
export function useAutoSaveContent({
  contentId,
  debounceMs = 500,
  onSaveSuccess,
  onSaveError,
}: UseAutoSaveContentOptions): UseAutoSaveContentReturn {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<Error | null>(null);

  const contentRepository = useRef(new ContentRepository()).current;
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDataRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Actual save function
  const performSave = useCallback(async (data: string) => {
    if (isSavingRef.current) {
      // If already saving, queue this data
      pendingDataRef.current = data;
      return;
    }

    try {
      isSavingRef.current = true;
      setSaveState('saving');
      setError(null);

      await contentRepository.updateContent(contentId, { data });

      setSaveState('saved');
      onSaveSuccess?.();

      // Clear "saved" indicator after 2 seconds
      setTimeout(() => {
        setSaveState((current) => (current === 'saved' ? 'idle' : current));
      }, 2000);

      // If there's pending data, save it
      if (pendingDataRef.current !== null && pendingDataRef.current !== data) {
        const pendingData = pendingDataRef.current;
        pendingDataRef.current = null;
        isSavingRef.current = false;
        await performSave(pendingData);
      } else {
        isSavingRef.current = false;
        pendingDataRef.current = null;
      }
    } catch (err) {
      const saveError = err instanceof Error ? err : new Error(String(err));
      setError(saveError);
      setSaveState('error');
      onSaveError?.(saveError);
      isSavingRef.current = false;
      pendingDataRef.current = null;
    }
  }, [contentId, contentRepository, onSaveSuccess, onSaveError]);

  // Debounced save function
  const save = useCallback((data: string) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      performSave(data);
    }, debounceMs);
  }, [debounceMs, performSave]);

  // Force immediate save (useful for onBlur or unmount)
  const forceSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (pendingDataRef.current !== null) {
      const data = pendingDataRef.current;
      pendingDataRef.current = null;
      await performSave(data);
    }
  }, [performSave]);

  return {
    saveState,
    save,
    forceSave,
    error,
  };
}
