import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  contentRepository,
  type BookClubRoom,
  type ClubMemberProgress,
} from "@/lib/list/ContentRepository";

// Fetch all book club rooms for a group
export function useBookClubRoomsQuery(groupId: string | null) {
  return useQuery({
    queryKey: ["bookclub-rooms", groupId],
    queryFn: async (): Promise<BookClubRoom[]> => {
      if (!groupId) return [];
      return contentRepository.getBookClubRooms(groupId);
    },
    enabled: !!groupId,
  });
}

// Fetch a single book club room by ID
export function useBookClubRoomQuery(clubId: string | null) {
  return useQuery({
    queryKey: ["bookclub-room", clubId],
    queryFn: async (): Promise<BookClubRoom | null> => {
      if (!clubId) return null;
      return contentRepository.getBookClubRoom(clubId);
    },
    enabled: !!clubId,
  });
}

// Fetch member progress for a book club
export function useBookClubMembersQuery(
  bookContentId: string | null,
  groupId: string | null
) {
  return useQuery({
    queryKey: ["bookclub-members", bookContentId, groupId],
    queryFn: async (): Promise<ClubMemberProgress[]> => {
      if (!bookContentId || !groupId) return [];
      return contentRepository.getBookClubRoomMembers(bookContentId, groupId);
    },
    enabled: !!bookContentId && !!groupId,
    staleTime: 30000, // 30 seconds - more frequent updates for member progress
  });
}

interface CreateBookClubRoomParams {
  name: string;
  groupId: string;
  bookContentId: string;
  userId?: string;
  username?: string;
}

// Create book club room mutation
export function useCreateBookClubRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      groupId,
      bookContentId,
      userId,
      username,
    }: CreateBookClubRoomParams): Promise<BookClubRoom | null> => {
      return contentRepository.createBookClubRoom(
        groupId,
        name,
        bookContentId,
        userId,
        username
      );
    },
    onSuccess: (data) => {
      if (data) {
        // Invalidate the book club rooms list for the group
        queryClient.invalidateQueries({
          queryKey: ["bookclub-rooms", data.group_id],
        });
      }
    },
  });
}

// Delete book club room mutation
export function useDeleteBookClubRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clubId,
      groupId,
    }: {
      clubId: string;
      groupId: string;
    }): Promise<boolean> => {
      return contentRepository.deleteBookClubRoom(clubId);
    },
    onSuccess: (_, variables) => {
      // Invalidate the book club rooms list for the group
      queryClient.invalidateQueries({
        queryKey: ["bookclub-rooms", variables.groupId],
      });
      // Also invalidate the single room query
      queryClient.invalidateQueries({
        queryKey: ["bookclub-room", variables.clubId],
      });
    },
  });
}
