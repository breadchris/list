import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useBookClubRoomsQuery,
  useCreateBookClubRoomMutation,
  useDeleteBookClubRoomMutation,
} from "./use-bookclub-queries";
import type { BookClubRoom } from "@/lib/list/ContentRepository";

interface UseBookClubRoomsOptions {
  groupId: string | null;
  userId: string | null;
  username?: string;
}

export function useBookClubRooms({
  groupId,
  userId,
  username,
}: UseBookClubRoomsOptions) {
  const router = useRouter();
  const { data: rooms = [], isLoading, error } = useBookClubRoomsQuery(groupId);
  const createMutation = useCreateBookClubRoomMutation();
  const deleteMutation = useDeleteBookClubRoomMutation();

  const createRoom = useCallback(
    async (name: string, bookContentId: string): Promise<BookClubRoom | null> => {
      if (!groupId) {
        console.error("Cannot create room: missing groupId");
        return null;
      }

      try {
        const room = await createMutation.mutateAsync({
          name,
          groupId,
          bookContentId,
          userId: userId || undefined,
          username,
        });
        return room;
      } catch (error) {
        console.error("Failed to create book club room:", error);
        return null;
      }
    },
    [groupId, userId, username, createMutation]
  );

  const deleteRoom = useCallback(
    async (clubId: string): Promise<boolean> => {
      if (!groupId) {
        console.error("Cannot delete room: missing groupId");
        return false;
      }

      try {
        await deleteMutation.mutateAsync({ clubId, groupId });
        return true;
      } catch (error) {
        console.error("Failed to delete book club room:", error);
        return false;
      }
    },
    [groupId, deleteMutation]
  );

  const getRoomUrl = useCallback((clubId: string): string => {
    if (typeof window === "undefined") {
      return `/bookclub/${clubId}`;
    }
    return `${window.location.origin}/bookclub/${clubId}`;
  }, []);

  const navigateToRoom = useCallback(
    (clubId: string) => {
      router.push(`/bookclub/${clubId}`);
    },
    [router]
  );

  const createAndNavigate = useCallback(
    async (name: string, bookContentId: string): Promise<void> => {
      const room = await createRoom(name, bookContentId);
      if (room) {
        navigateToRoom(room.id);
      }
    },
    [createRoom, navigateToRoom]
  );

  return {
    rooms,
    isLoading,
    error,
    createRoom,
    deleteRoom,
    getRoomUrl,
    navigateToRoom,
    createAndNavigate,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
