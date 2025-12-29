import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contentRepository, Content } from "@/lib/list/ContentRepository";
import {
  getLocalReadingPosition,
  setLocalReadingPosition,
} from "@/lib/reading-position-storage";
import type {
  ReadingPosition,
  Bookmark,
  Highlight,
} from "@/types/reading-position";
import { supabase } from "@/lib/list/SupabaseClient";

interface UseReadingPositionOptions {
  bookContentId: string | null;
  groupId: string | null;
  enabled?: boolean;
}

interface UseReadingPositionReturn {
  // Current state
  location: string;
  progressPercent: number;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  isLoading: boolean;
  isBackgroundSyncing: boolean;
  isSyncing: boolean;

  // Actions
  updateLocation: (cfi: string, progressPercent?: number) => void;
  addBookmark: (cfi: string, label?: string, note?: string) => void;
  removeBookmark: (id: string) => void;
  addHighlight: (
    cfiRange: string,
    text: string,
    color?: string,
    note?: string
  ) => void;
  removeHighlight: (id: string) => void;

  // Sync control
  flushToSupabase: () => Promise<void>;
}

const DEFAULT_POSITION: ReadingPosition = {
  location: "",
  progress_percent: 0,
  last_read_at: new Date().toISOString(),
  bookmarks: [],
  highlights: [],
};

const DEBOUNCE_MS = 2000;

export function useReadingPosition({
  bookContentId,
  groupId,
  enabled = true,
}: UseReadingPositionOptions): UseReadingPositionReturn {
  const queryClient = useQueryClient();

  // Local state for immediate UI updates
  // Use lazy initialization to load from localStorage synchronously on first render
  const [position, setPosition] = useState<ReadingPosition>(() => {
    if (bookContentId && typeof window !== "undefined") {
      const localPosition = getLocalReadingPosition(bookContentId);
      if (localPosition) {
        return localPosition;
      }
    }
    return DEFAULT_POSITION;
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Reload from localStorage when bookContentId changes (handles case when ID is null on mount)
  useEffect(() => {
    if (!bookContentId || !enabled) return;

    const localPosition = getLocalReadingPosition(bookContentId);
    if (localPosition) {
      setPosition(localPosition);
    } else {
      // Reset to default if no saved position for this book
      setPosition(DEFAULT_POSITION);
    }
  }, [bookContentId, enabled]);

  // Track pending changes for debounced sync
  const pendingChangesRef = useRef<ReadingPosition | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get user ID for queries
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  // Query key for React Query
  const queryKey = ["reading-position", bookContentId, userId];

  // Fetch from Supabase and merge with localStorage
  const { isLoading: isQueryLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!bookContentId || !userId) return null;

      const content = await contentRepository.getReadingPosition(
        bookContentId,
        userId
      );

      if (!content) return null;

      // Convert content to ReadingPosition
      const remotePosition: ReadingPosition = {
        location: content.data,
        progress_percent: content.metadata?.progress_percent ?? 0,
        last_read_at: content.metadata?.last_read_at ?? content.updated_at,
        bookmarks: content.metadata?.bookmarks ?? [],
        highlights: content.metadata?.highlights ?? [],
      };

      return remotePosition;
    },
    enabled: !!bookContentId && !!userId && enabled,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    // Return localStorage data immediately while fetching from Supabase
    placeholderData: () => {
      if (!bookContentId) return null;
      return getLocalReadingPosition(bookContentId);
    },
  });

  // When Supabase data arrives, merge with local state
  useEffect(() => {
    if (!bookContentId) return;

    const localPosition = getLocalReadingPosition(bookContentId);

    queryClient.getQueryData(queryKey);

    // Subscribe to query data changes
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        JSON.stringify(event.query.queryKey) === JSON.stringify(queryKey)
      ) {
        const remotePosition = event.query.state.data as ReadingPosition | null;

        if (remotePosition && localPosition) {
          // Compare timestamps - use the newer one
          const localTime = new Date(localPosition.last_read_at).getTime();
          const remoteTime = new Date(remotePosition.last_read_at).getTime();

          if (remoteTime > localTime) {
            setPosition(remotePosition);
            setLocalReadingPosition(bookContentId, remotePosition);
          }
        } else if (remotePosition) {
          setPosition(remotePosition);
          setLocalReadingPosition(bookContentId, remotePosition);
        }
      }
    });

    return () => unsubscribe();
  }, [bookContentId, queryClient, queryKey]);

  // Mutation for syncing to Supabase
  const syncMutation = useMutation({
    mutationFn: async (pos: ReadingPosition) => {
      if (!bookContentId || !groupId) {
        throw new Error("Missing bookContentId or groupId");
      }

      return contentRepository.upsertReadingPosition(bookContentId, groupId, pos);
    },
    onSuccess: () => {
      // Invalidate query to refresh
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      console.error("Failed to sync reading position:", error);
    },
  });

  // Debounced sync function
  const scheduleSync = useCallback(
    (newPosition: ReadingPosition) => {
      pendingChangesRef.current = newPosition;

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Schedule new sync
      debounceTimerRef.current = setTimeout(() => {
        if (pendingChangesRef.current) {
          setIsSyncing(true);
          syncMutation.mutate(pendingChangesRef.current, {
            onSettled: () => {
              setIsSyncing(false);
              pendingChangesRef.current = null;
            },
          });
        }
      }, DEBOUNCE_MS);
    },
    [syncMutation]
  );

  // Update local state and schedule sync
  const updatePosition = useCallback(
    (updater: (prev: ReadingPosition) => ReadingPosition) => {
      setPosition((prev) => {
        const updated = updater(prev);
        updated.last_read_at = new Date().toISOString();

        // Save to localStorage immediately
        if (bookContentId) {
          setLocalReadingPosition(bookContentId, updated);
        }

        // Schedule debounced sync to Supabase
        scheduleSync(updated);

        return updated;
      });
    },
    [bookContentId, scheduleSync]
  );

  // Update location (debounced)
  const updateLocation = useCallback(
    (cfi: string, progressPercent?: number) => {
      updatePosition((prev) => ({
        ...prev,
        location: cfi,
        progress_percent: progressPercent ?? prev.progress_percent,
      }));
    },
    [updatePosition]
  );

  // Add bookmark (immediate sync)
  const addBookmark = useCallback(
    (cfi: string, label?: string, note?: string) => {
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        cfi,
        label,
        note,
        created_at: new Date().toISOString(),
      };

      setPosition((prev) => {
        const updated = {
          ...prev,
          bookmarks: [...prev.bookmarks, newBookmark],
          last_read_at: new Date().toISOString(),
        };

        // Save to localStorage
        if (bookContentId) {
          setLocalReadingPosition(bookContentId, updated);
        }

        // Immediate sync for explicit user action
        if (bookContentId && groupId) {
          setIsSyncing(true);
          syncMutation.mutate(updated, {
            onSettled: () => setIsSyncing(false),
          });
        }

        return updated;
      });
    },
    [bookContentId, groupId, syncMutation]
  );

  // Remove bookmark (immediate sync)
  const removeBookmark = useCallback(
    (id: string) => {
      setPosition((prev) => {
        const updated = {
          ...prev,
          bookmarks: prev.bookmarks.filter((b) => b.id !== id),
          last_read_at: new Date().toISOString(),
        };

        if (bookContentId) {
          setLocalReadingPosition(bookContentId, updated);
        }

        if (bookContentId && groupId) {
          setIsSyncing(true);
          syncMutation.mutate(updated, {
            onSettled: () => setIsSyncing(false),
          });
        }

        return updated;
      });
    },
    [bookContentId, groupId, syncMutation]
  );

  // Add highlight (immediate sync)
  const addHighlight = useCallback(
    (cfiRange: string, text: string, color: string = "yellow", note?: string) => {
      const newHighlight: Highlight = {
        id: crypto.randomUUID(),
        cfi_range: cfiRange,
        text,
        color,
        note,
        created_at: new Date().toISOString(),
      };

      setPosition((prev) => {
        const updated = {
          ...prev,
          highlights: [...prev.highlights, newHighlight],
          last_read_at: new Date().toISOString(),
        };

        if (bookContentId) {
          setLocalReadingPosition(bookContentId, updated);
        }

        if (bookContentId && groupId) {
          setIsSyncing(true);
          syncMutation.mutate(updated, {
            onSettled: () => setIsSyncing(false),
          });
        }

        return updated;
      });
    },
    [bookContentId, groupId, syncMutation]
  );

  // Remove highlight (immediate sync)
  const removeHighlight = useCallback(
    (id: string) => {
      setPosition((prev) => {
        const updated = {
          ...prev,
          highlights: prev.highlights.filter((h) => h.id !== id),
          last_read_at: new Date().toISOString(),
        };

        if (bookContentId) {
          setLocalReadingPosition(bookContentId, updated);
        }

        if (bookContentId && groupId) {
          setIsSyncing(true);
          syncMutation.mutate(updated, {
            onSettled: () => setIsSyncing(false),
          });
        }

        return updated;
      });
    },
    [bookContentId, groupId, syncMutation]
  );

  // Flush pending changes to Supabase (for window blur/unload)
  const flushToSupabase = useCallback(async () => {
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Get the current position from localStorage (most up-to-date)
    const currentPosition = bookContentId
      ? getLocalReadingPosition(bookContentId)
      : null;

    if (currentPosition && bookContentId && groupId) {
      try {
        await contentRepository.upsertReadingPosition(
          bookContentId,
          groupId,
          currentPosition
        );
      } catch (error) {
        console.error("Failed to flush reading position:", error);
      }
    }
  }, [bookContentId, groupId]);

  // Flush on window blur/unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushToSupabase();
      }
    };

    const handleBeforeUnload = () => {
      flushToSupabase();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Clean up timer on unmount
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [flushToSupabase]);

  return {
    location: position.location,
    progressPercent: position.progress_percent,
    bookmarks: position.bookmarks,
    highlights: position.highlights,
    // Never block on loading - localStorage provides immediate data
    isLoading: false,
    // Expose background sync state for optional UI indicators
    isBackgroundSyncing: isQueryLoading,
    isSyncing,
    updateLocation,
    addBookmark,
    removeBookmark,
    addHighlight,
    removeHighlight,
    flushToSupabase,
  };
}
