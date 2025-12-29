import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useTimeRoomsQuery,
  useCreateTimeRoomMutation,
  useDeleteTimeRoomMutation,
} from "@/hooks/time/use-time-room-queries";
import type { Content } from "@/lib/list/ContentRepository";

interface UseTimeRoomsOptions {
  groupId: string | null;
  userId: string | null;
  username?: string;
}

export function useTimeRooms({ groupId, userId, username }: UseTimeRoomsOptions) {
  const router = useRouter();
  const { data: calendars = [], isLoading, error } = useTimeRoomsQuery(groupId);
  const createMutation = useCreateTimeRoomMutation();
  const deleteMutation = useDeleteTimeRoomMutation();

  const createCalendar = useCallback(
    async (name: string): Promise<Content | null> => {
      if (!groupId || !userId) {
        console.error("Cannot create calendar: missing groupId or userId");
        return null;
      }

      try {
        const calendar = await createMutation.mutateAsync({
          name,
          group_id: groupId,
          user_id: userId,
          username,
        });
        return calendar;
      } catch (error) {
        console.error("Failed to create calendar:", error);
        return null;
      }
    },
    [groupId, userId, username, createMutation]
  );

  const deleteCalendar = useCallback(
    async (calendarId: string): Promise<boolean> => {
      if (!groupId) {
        console.error("Cannot delete calendar: missing groupId");
        return false;
      }

      try {
        await deleteMutation.mutateAsync({ calendarId, groupId });
        return true;
      } catch (error) {
        console.error("Failed to delete calendar:", error);
        return false;
      }
    },
    [groupId, deleteMutation]
  );

  const getCalendarUrl = useCallback((calendarId: string): string => {
    if (typeof window === "undefined") {
      return `/time/${calendarId}`;
    }
    return `${window.location.origin}/time/${calendarId}`;
  }, []);

  const navigateToCalendar = useCallback(
    (calendarId: string) => {
      router.push(`/time/${calendarId}`);
    },
    [router]
  );

  const createAndNavigate = useCallback(
    async (name: string): Promise<void> => {
      const calendar = await createCalendar(name);
      if (calendar) {
        navigateToCalendar(calendar.id);
      }
    },
    [createCalendar, navigateToCalendar]
  );

  return {
    calendars,
    isLoading,
    error,
    createCalendar,
    deleteCalendar,
    getCalendarUrl,
    navigateToCalendar,
    createAndNavigate,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
