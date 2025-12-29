import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  contentRepository,
  Content,
  ClubMemberProgress,
} from "@/lib/list/ContentRepository";
import { useGlobalGroup } from "@/components/GlobalGroupContext";

export interface ClubBook {
  clubContentId: string;
  bookContentId: string;
  groupId: string;
  title: string;
  epubUrl: string;
  book: Content;
}

/**
 * Hook to fetch the club book for the current group
 */
export function useClubBook() {
  const { selectedGroup, isLoading: isLoadingGroup } = useGlobalGroup();

  const query = useQuery({
    queryKey: ["club-book", selectedGroup?.id],
    queryFn: async (): Promise<ClubBook | null> => {
      if (!selectedGroup?.id) return null;

      const result = await contentRepository.getClubBookWithContent(
        selectedGroup.id
      );

      if (!result) return null;

      const metadata = result.book.metadata || {};

      // Extract title from metadata or parse from URL
      let title = metadata.filename || "";
      if (!title && result.book.data) {
        try {
          const url = new URL(result.book.data);
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
        clubContentId: result.club.id,
        bookContentId: result.book.id,
        groupId: result.book.group_id,
        title: title || "Unknown Book",
        epubUrl: metadata.file_url || "",
        book: result.book,
      };
    },
    enabled: !!selectedGroup?.id,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });

  return {
    clubBook: query.data ?? null,
    isLoading: query.isLoading || isLoadingGroup,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * Hook to set a book as the club book
 */
export function useSetClubBook() {
  const queryClient = useQueryClient();
  const { selectedGroup } = useGlobalGroup();

  return useMutation({
    mutationFn: async (bookContentId: string) => {
      if (!selectedGroup?.id) {
        throw new Error("No group selected");
      }
      return contentRepository.setClubBook(selectedGroup.id, bookContentId);
    },
    onSuccess: () => {
      // Invalidate club book query to refetch
      queryClient.invalidateQueries({
        queryKey: ["club-book", selectedGroup?.id],
      });
      // Also invalidate group books to update UI
      queryClient.invalidateQueries({
        queryKey: ["group-books"],
      });
    },
  });
}

/**
 * Hook to clear the club book
 */
export function useClearClubBook() {
  const queryClient = useQueryClient();
  const { selectedGroup } = useGlobalGroup();

  return useMutation({
    mutationFn: async () => {
      if (!selectedGroup?.id) {
        throw new Error("No group selected");
      }
      return contentRepository.clearClubBook(selectedGroup.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["club-book", selectedGroup?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-books"],
      });
    },
  });
}

/**
 * Hook to fetch all members' progress for the club book
 */
export function useClubMemberProgress(bookContentId: string | null) {
  const { selectedGroup } = useGlobalGroup();

  return useQuery({
    queryKey: ["club-member-progress", bookContentId, selectedGroup?.id],
    queryFn: async (): Promise<ClubMemberProgress[]> => {
      if (!bookContentId || !selectedGroup?.id) return [];

      return contentRepository.getClubMemberProgress(
        bookContentId,
        selectedGroup.id
      );
    },
    enabled: !!bookContentId && !!selectedGroup?.id,
    staleTime: 30000, // 30 seconds - more frequent updates for member progress
    gcTime: 300000, // 5 minutes
  });
}

/**
 * Check if a book is the current club book
 */
export function useIsClubBook(bookContentId: string | null) {
  const { clubBook } = useClubBook();

  return clubBook?.bookContentId === bookContentId;
}
