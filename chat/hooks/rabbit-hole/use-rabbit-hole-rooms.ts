import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/list/SupabaseClient";
import type { Content } from "@/lib/list/ContentRepository";
import {
  RABBIT_HOLE_CONTENT_TYPE,
  type RabbitHoleRoom,
  type RabbitHolePage,
  type RabbitHoleMetadata,
} from "@/types/rabbit-hole";

// Fetch all rabbit hole rooms for a group
export function useRabbitHoleRoomsQuery(groupId: string | null) {
  return useQuery({
    queryKey: ["rabbit-hole-rooms", groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("type", RABBIT_HOLE_CONTENT_TYPE)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching rabbit hole rooms:", error);
        throw error;
      }

      return data as RabbitHoleRoom[];
    },
    enabled: !!groupId,
  });
}

// Fetch a single rabbit hole room by ID
export function useRabbitHoleRoomQuery(roomId: string | null) {
  return useQuery({
    queryKey: ["rabbit-hole-room", roomId],
    queryFn: async () => {
      if (!roomId) return null;

      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("id", roomId)
        .eq("type", RABBIT_HOLE_CONTENT_TYPE)
        .single();

      if (error) {
        console.error("Error fetching rabbit hole room:", error);
        throw error;
      }

      return data as RabbitHoleRoom;
    },
    enabled: !!roomId,
  });
}

interface CreateRabbitHoleRoomParams {
  title: string;
  group_id: string;
  user_id: string;
  username?: string;
}

// Create rabbit hole room mutation
export function useCreateRabbitHoleRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, group_id, user_id, username }: CreateRabbitHoleRoomParams) => {
      if (typeof title !== "string" || title.trim().length === 0) {
        throw new Error("Room title must be a non-empty string");
      }

      const metadata: RabbitHoleMetadata = {
        title: title.trim(),
        created_by_username: username || "Anonymous",
        pages: {},
        root_page_id: null,
      };

      const { data, error } = await supabase
        .from("content")
        .insert([
          {
            type: RABBIT_HOLE_CONTENT_TYPE,
            data: title.trim(),
            group_id,
            user_id,
            metadata,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Error creating rabbit hole room:", error);
        throw error;
      }

      return data as RabbitHoleRoom;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rabbit-hole-rooms", data.group_id] });
    },
  });
}

// Delete rabbit hole room mutation
export function useDeleteRabbitHoleRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, groupId }: { roomId: string; groupId: string }) => {
      const { error } = await supabase
        .from("content")
        .delete()
        .eq("id", roomId)
        .eq("type", RABBIT_HOLE_CONTENT_TYPE);

      if (error) {
        console.error("Error deleting rabbit hole room:", error);
        throw error;
      }

      return { roomId, groupId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rabbit-hole-rooms", data.groupId] });
      queryClient.invalidateQueries({ queryKey: ["rabbit-hole-room", data.roomId] });
    },
  });
}

// Update a page in the room's metadata
export function useUpdateRabbitHolePageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roomId,
      pageId,
      page,
      setAsRoot = false,
    }: {
      roomId: string;
      pageId: string;
      page: RabbitHolePage;
      setAsRoot?: boolean;
    }) => {
      // Fetch existing metadata
      const { data: existing, error: fetchError } = await supabase
        .from("content")
        .select("metadata, group_id")
        .eq("id", roomId)
        .single();

      if (fetchError) {
        console.error("Error fetching room for page update:", fetchError);
        throw fetchError;
      }

      const currentMetadata = (existing?.metadata || {}) as RabbitHoleMetadata;
      const updatedPages = {
        ...currentMetadata.pages,
        [pageId]: page,
      };

      const updatedMetadata: RabbitHoleMetadata = {
        ...currentMetadata,
        pages: updatedPages,
        root_page_id: setAsRoot ? pageId : currentMetadata.root_page_id,
      };

      const { data, error } = await supabase
        .from("content")
        .update({ metadata: updatedMetadata })
        .eq("id", roomId)
        .select()
        .single();

      if (error) {
        console.error("Error updating page:", error);
        throw error;
      }

      return { room: data as RabbitHoleRoom, groupId: existing?.group_id };
    },
    onSuccess: (data) => {
      // Immediately update the cache with the new room data
      queryClient.setQueryData(["rabbit-hole-room", data.room.id], data.room);
      // Still invalidate to ensure consistency on next refetch
      queryClient.invalidateQueries({ queryKey: ["rabbit-hole-room", data.room.id] });
      if (data.groupId) {
        queryClient.invalidateQueries({ queryKey: ["rabbit-hole-rooms", data.groupId] });
      }
    },
  });
}

// Delete a page from the room's metadata
export function useDeleteRabbitHolePageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roomId,
      pageId,
    }: {
      roomId: string;
      pageId: string;
    }) => {
      // Fetch existing metadata
      const { data: existing, error: fetchError } = await supabase
        .from("content")
        .select("metadata, group_id")
        .eq("id", roomId)
        .single();

      if (fetchError) {
        console.error("Error fetching room for page deletion:", fetchError);
        throw fetchError;
      }

      const currentMetadata = (existing?.metadata || {}) as RabbitHoleMetadata;
      const { [pageId]: removed, ...remainingPages } = currentMetadata.pages;

      // If we're deleting the root page, clear root_page_id
      const updatedMetadata: RabbitHoleMetadata = {
        ...currentMetadata,
        pages: remainingPages,
        root_page_id: currentMetadata.root_page_id === pageId ? null : currentMetadata.root_page_id,
      };

      const { data, error } = await supabase
        .from("content")
        .update({ metadata: updatedMetadata })
        .eq("id", roomId)
        .select()
        .single();

      if (error) {
        console.error("Error deleting page:", error);
        throw error;
      }

      return { room: data as RabbitHoleRoom, groupId: existing?.group_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rabbit-hole-room", data.room.id] });
      if (data.groupId) {
        queryClient.invalidateQueries({ queryKey: ["rabbit-hole-rooms", data.groupId] });
      }
    },
  });
}
