import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/list/SupabaseClient";
import type { Content } from "@/lib/list/ContentRepository";
import { TIME_CONTENT_TYPE } from "@/types/time";

/**
 * Fetch all calendars for a group
 */
export function useTimeRoomsQuery(groupId: string | null) {
  return useQuery({
    queryKey: ["time-rooms", groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("type", TIME_CONTENT_TYPE)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching calendars:", error);
        throw error;
      }

      return data as Content[];
    },
    enabled: !!groupId,
  });
}

/**
 * Fetch a single calendar by ID
 */
export function useTimeRoomQuery(calendarId: string | null) {
  return useQuery({
    queryKey: ["time-room", calendarId],
    queryFn: async () => {
      if (!calendarId) return null;

      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("id", calendarId)
        .eq("type", TIME_CONTENT_TYPE)
        .single();

      if (error) {
        console.error("Error fetching calendar:", error);
        throw error;
      }

      return data as Content;
    },
    enabled: !!calendarId,
  });
}

interface CreateTimeRoomParams {
  name: string;
  group_id: string;
  user_id: string;
  username?: string;
}

/**
 * Create a new calendar
 */
export function useCreateTimeRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, group_id, user_id, username }: CreateTimeRoomParams) => {
      // Validate calendar name
      if (typeof name !== "string" || name.trim().length === 0) {
        throw new Error("Calendar name must be a non-empty string");
      }

      const { data, error } = await supabase
        .from("content")
        .insert([
          {
            type: TIME_CONTENT_TYPE,
            data: name,
            group_id,
            user_id,
            metadata: {
              title: name,
              created_by_username: username || "Anonymous",
            },
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Error creating calendar:", error);
        throw error;
      }

      return data as Content;
    },
    onSuccess: (data) => {
      // Invalidate the calendars list for the group
      queryClient.invalidateQueries({ queryKey: ["time-rooms", data.group_id] });
    },
  });
}

interface DeleteTimeRoomParams {
  calendarId: string;
  groupId: string;
}

/**
 * Delete a calendar
 */
export function useDeleteTimeRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ calendarId, groupId }: DeleteTimeRoomParams) => {
      const { error } = await supabase
        .from("content")
        .delete()
        .eq("id", calendarId)
        .eq("type", TIME_CONTENT_TYPE);

      if (error) {
        console.error("Error deleting calendar:", error);
        throw error;
      }

      return { calendarId, groupId };
    },
    onSuccess: (data) => {
      // Invalidate the calendars list for the group
      queryClient.invalidateQueries({ queryKey: ["time-rooms", data.groupId] });
      // Also invalidate the single calendar query
      queryClient.invalidateQueries({ queryKey: ["time-room", data.calendarId] });
    },
  });
}
