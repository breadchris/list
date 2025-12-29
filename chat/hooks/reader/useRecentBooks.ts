import { useQuery } from "@tanstack/react-query";
import { contentRepository } from "@/lib/list/ContentRepository";
import { supabase } from "@/lib/list/SupabaseClient";
import { useEffect, useState } from "react";

export interface RecentBook {
  bookContentId: string;
  groupId: string;
  title: string;
  epubUrl: string;
  progressPercent: number;
  lastReadAt: string;
}

/**
 * Hook to fetch recently read books for the current user
 */
export function useRecentBooks(limit: number = 10) {
  const [userId, setUserId] = useState<string | null>(null);

  // Get user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  const query = useQuery({
    queryKey: ["recent-books", userId, limit],
    queryFn: async (): Promise<RecentBook[]> => {
      if (!userId) return [];

      const positions = await contentRepository.getRecentReadingPositions(
        userId,
        limit
      );

      // Transform to RecentBook format
      return positions
        .filter((pos) => pos.parent && pos.parent.type === "epub")
        .map((pos) => {
          const parent = pos.parent!;
          const metadata = pos.metadata || {};
          const parentMetadata = parent.metadata || {};

          // Extract title from parent metadata or parse from URL
          let title = parentMetadata.filename || "";
          if (!title && parent.data) {
            try {
              const url = new URL(parent.data);
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
            bookContentId: parent.id,
            groupId: parent.group_id,
            title: title || "Unknown Book",
            epubUrl: parent.data,
            progressPercent: metadata.progress_percent || 0,
            lastReadAt: metadata.last_read_at || pos.updated_at,
          };
        });
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });

  return {
    recentBooks: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * Format relative time (e.g., "2 hours ago", "Yesterday")
 */
export function formatRelativeTime(isoString: string): string {
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
