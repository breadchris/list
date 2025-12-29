import { useQuery } from "@tanstack/react-query";
import { contentRepository, Content } from "@/lib/list/ContentRepository";
import { supabase } from "@/lib/list/SupabaseClient";
import { useEffect, useState } from "react";
import { useGlobalGroup } from "@/components/GlobalGroupContext";

export interface GroupBook {
  bookContentId: string;
  groupId: string;
  title: string;
  epubUrl: string;
  progressPercent: number;
  lastReadAt: string | null;
  hasStartedReading: boolean;
}

/**
 * Hook to fetch all EPUB books for the current group with reading progress
 */
export function useGroupBooks() {
  const { selectedGroup, isLoading: isLoadingGroup } = useGlobalGroup();
  const [userId, setUserId] = useState<string | null>(null);

  // Get user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  const query = useQuery({
    queryKey: ["group-books", selectedGroup?.id, userId],
    queryFn: async (): Promise<GroupBook[]> => {
      if (!userId || !selectedGroup?.id) return [];

      const results = await contentRepository.getEpubsForGroup(
        selectedGroup.id,
        userId
      );

      // Transform to GroupBook format
      return results.map((item) => {
        const metadata = item.book.metadata || {};

        // Extract title from metadata or parse from URL
        let title = metadata.filename || "";
        if (!title && item.book.data) {
          try {
            const url = new URL(item.book.data);
            const pathParts = url.pathname.split("/");
            title = decodeURIComponent(pathParts[pathParts.length - 1] || "");
          } catch {
            title = "Unknown Book";
          }
        }

        // Remove .epub extension for display
        if (title.toLowerCase().endsWith(".epub")) {
          title = title.slice(0, -5);
        }

        return {
          bookContentId: item.book.id,
          groupId: item.book.group_id,
          title: title || "Unknown Book",
          epubUrl: metadata.file_url || "",
          progressPercent: item.readingPosition?.progress_percent || 0,
          lastReadAt: item.readingPosition?.last_read_at || null,
          hasStartedReading: !!item.readingPosition,
        };
      });
    },
    enabled: !!userId && !!selectedGroup?.id,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });

  // Split into recently read and unread books
  const allBooks = query.data || [];
  const recentlyReadBooks = allBooks.filter((book) => book.hasStartedReading);
  const unreadBooks = allBooks.filter((book) => !book.hasStartedReading);

  return {
    allBooks,
    recentlyReadBooks,
    unreadBooks,
    isLoading: query.isLoading || isLoadingGroup,
    isError: query.isError,
    refetch: query.refetch,
    selectedGroup,
  };
}

/**
 * Format relative time (e.g., "2 hours ago", "Yesterday")
 */
export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "";

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "Just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}
