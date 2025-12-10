import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/list/SupabaseClient";
import type { Content } from "@/lib/list/ContentRepository";

// Fetch all DJ rooms for a group
export function useDjRoomsQuery(groupId: string | null) {
  return useQuery({
    queryKey: ["dj-rooms", groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("type", "dj")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching DJ rooms:", error);
        throw error;
      }

      return data as Content[];
    },
    enabled: !!groupId,
  });
}

// Fetch a single DJ room by ID
export function useDjRoomQuery(roomId: string | null) {
  return useQuery({
    queryKey: ["dj-room", roomId],
    queryFn: async () => {
      if (!roomId) return null;

      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("id", roomId)
        .eq("type", "dj")
        .single();

      if (error) {
        console.error("Error fetching DJ room:", error);
        throw error;
      }

      return data as Content;
    },
    enabled: !!roomId,
  });
}

interface CreateDjRoomParams {
  name: string;
  group_id: string;
  user_id: string;
  username?: string;
}

// Create DJ room mutation
export function useCreateDjRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, group_id, user_id, username }: CreateDjRoomParams) => {
      const { data, error } = await supabase
        .from("content")
        .insert([
          {
            type: "dj",
            data: name,
            group_id,
            user_id,
            metadata: {
              created_by_username: username || "Anonymous",
            },
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Error creating DJ room:", error);
        throw error;
      }

      return data as Content;
    },
    onSuccess: (data) => {
      // Invalidate the DJ rooms list for the group
      queryClient.invalidateQueries({ queryKey: ["dj-rooms", data.group_id] });
    },
  });
}

// Delete DJ room mutation
export function useDeleteDjRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, groupId }: { roomId: string; groupId: string }) => {
      const { error } = await supabase
        .from("content")
        .delete()
        .eq("id", roomId)
        .eq("type", "dj");

      if (error) {
        console.error("Error deleting DJ room:", error);
        throw error;
      }

      return { roomId, groupId };
    },
    onSuccess: (data) => {
      // Invalidate the DJ rooms list for the group
      queryClient.invalidateQueries({ queryKey: ["dj-rooms", data.groupId] });
      // Also invalidate the single room query
      queryClient.invalidateQueries({ queryKey: ["dj-room", data.roomId] });
    },
  });
}
