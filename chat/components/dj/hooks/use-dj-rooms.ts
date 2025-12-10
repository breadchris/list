import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useDjRoomsQuery,
  useCreateDjRoomMutation,
  useDeleteDjRoomMutation,
} from "@/hooks/list/useDjRoomQueries";
import type { Content } from "@/lib/list/ContentRepository";

interface UseDjRoomsOptions {
  groupId: string | null;
  userId: string | null;
  username?: string;
}

export function useDjRooms({ groupId, userId, username }: UseDjRoomsOptions) {
  const router = useRouter();
  const { data: rooms = [], isLoading, error } = useDjRoomsQuery(groupId);
  const createMutation = useCreateDjRoomMutation();
  const deleteMutation = useDeleteDjRoomMutation();

  const createRoom = useCallback(
    async (name: string): Promise<Content | null> => {
      if (!groupId || !userId) {
        console.error("Cannot create room: missing groupId or userId");
        return null;
      }

      try {
        const room = await createMutation.mutateAsync({
          name,
          group_id: groupId,
          user_id: userId,
          username,
        });
        return room;
      } catch (error) {
        console.error("Failed to create DJ room:", error);
        return null;
      }
    },
    [groupId, userId, username, createMutation]
  );

  const deleteRoom = useCallback(
    async (roomId: string): Promise<boolean> => {
      if (!groupId) {
        console.error("Cannot delete room: missing groupId");
        return false;
      }

      try {
        await deleteMutation.mutateAsync({ roomId, groupId });
        return true;
      } catch (error) {
        console.error("Failed to delete DJ room:", error);
        return false;
      }
    },
    [groupId, deleteMutation]
  );

  const getRoomUrl = useCallback((roomId: string): string => {
    if (typeof window === "undefined") {
      return `/dj/${roomId}`;
    }
    return `${window.location.origin}/dj/${roomId}`;
  }, []);

  const navigateToRoom = useCallback(
    (roomId: string) => {
      router.push(`/dj/${roomId}`);
    },
    [router]
  );

  const createAndNavigate = useCallback(
    async (name: string): Promise<void> => {
      const room = await createRoom(name);
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
