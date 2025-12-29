import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/list/SupabaseClient";
import type { Content } from "@/lib/list/ContentRepository";
import { WIKI_CONTENT_TYPE } from "@/types/wiki";

// Fetch all wikis for a group
export function useWikiRoomsQuery(groupId: string | null) {
  return useQuery({
    queryKey: ["wiki-rooms", groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("type", WIKI_CONTENT_TYPE)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching wikis:", error);
        throw error;
      }

      return data as Content[];
    },
    enabled: !!groupId,
  });
}

// Fetch a single wiki by ID
export function useWikiRoomQuery(wikiId: string | null) {
  return useQuery({
    queryKey: ["wiki-room", wikiId],
    queryFn: async () => {
      if (!wikiId) return null;

      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("id", wikiId)
        .eq("type", WIKI_CONTENT_TYPE)
        .single();

      if (error) {
        console.error("Error fetching wiki:", error);
        throw error;
      }

      return data as Content;
    },
    enabled: !!wikiId,
  });
}

interface CreateWikiRoomParams {
  name: string;
  group_id: string;
  user_id: string;
  username?: string;
}

// Create wiki mutation
export function useCreateWikiRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, group_id, user_id, username }: CreateWikiRoomParams) => {
      // Validate wiki name - data field must only contain the name string
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new Error('Wiki name must be a non-empty string');
      }

      const { data, error } = await supabase
        .from("content")
        .insert([
          {
            type: WIKI_CONTENT_TYPE,
            data: name,  // Store wiki name (published blob stored in metadata when published)
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
        console.error("Error creating wiki:", error);
        throw error;
      }

      return data as Content;
    },
    onSuccess: (data) => {
      // Invalidate the wikis list for the group
      queryClient.invalidateQueries({ queryKey: ["wiki-rooms", data.group_id] });
    },
  });
}

// Rename wiki mutation
export function useRenameWikiMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wikiId, newTitle }: { wikiId: string; newTitle: string }) => {
      // Validate new title
      if (!newTitle.trim()) {
        throw new Error('Wiki name cannot be empty');
      }

      // Fetch existing metadata to preserve other fields
      const { data: existing, error: fetchError } = await supabase
        .from("content")
        .select("metadata, group_id")
        .eq("id", wikiId)
        .single();

      if (fetchError) {
        console.error("Error fetching wiki for rename:", fetchError);
        throw fetchError;
      }

      // Update metadata with new title
      const updatedMetadata = {
        ...(existing?.metadata || {}),
        title: newTitle.trim(),
      };

      const { data, error } = await supabase
        .from("content")
        .update({
          metadata: updatedMetadata,
          data: newTitle.trim(),  // Also update data field for consistency
        })
        .eq("id", wikiId)
        .select()
        .single();

      if (error) {
        console.error("Error renaming wiki:", error);
        throw error;
      }

      return { ...data, group_id: existing?.group_id } as Content & { group_id: string };
    },
    onSuccess: (data) => {
      // Invalidate both single wiki and list queries
      queryClient.invalidateQueries({ queryKey: ["wiki-room", data.id] });
      queryClient.invalidateQueries({ queryKey: ["wiki-rooms", data.group_id] });
    },
  });
}

// Delete wiki mutation
export function useDeleteWikiRoomMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wikiId, groupId }: { wikiId: string; groupId: string }) => {
      const { error } = await supabase
        .from("content")
        .delete()
        .eq("id", wikiId)
        .eq("type", WIKI_CONTENT_TYPE);

      if (error) {
        console.error("Error deleting wiki:", error);
        throw error;
      }

      return { wikiId, groupId };
    },
    onSuccess: (data) => {
      // Invalidate the wikis list for the group
      queryClient.invalidateQueries({ queryKey: ["wiki-rooms", data.groupId] });
      // Also invalidate the single wiki query
      queryClient.invalidateQueries({ queryKey: ["wiki-room", data.wikiId] });
    },
  });
}
