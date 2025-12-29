import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/list/SupabaseClient";
import type { Content } from "@/lib/list/ContentRepository";
import type { CodeSessionMetadata } from "@/components/code/types";

// Fetch all code sessions for a group
export function useCodeSessionsQuery(groupId: string | null) {
  return useQuery({
    queryKey: ["code-sessions", groupId],
    queryFn: async () => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("type", "code_session")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching code sessions:", error);
        throw error;
      }

      return data as Content[];
    },
    enabled: !!groupId,
  });
}

// Fetch a single code session by ID
export function useCodeSessionQuery(sessionId: string | null) {
  return useQuery({
    queryKey: ["code-session", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;

      const { data, error } = await supabase
        .from("content")
        .select("*")
        .eq("id", sessionId)
        .eq("type", "code_session")
        .single();

      if (error) {
        console.error("Error fetching code session:", error);
        throw error;
      }

      return data as Content;
    },
    enabled: !!sessionId,
  });
}

interface CreateCodeSessionParams {
  name: string;
  group_id: string;
  user_id: string;
  username?: string;
  initial_prompt?: string;
}

// Create code session mutation
export function useCreateCodeSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      group_id,
      user_id,
      username,
      initial_prompt,
    }: CreateCodeSessionParams) => {
      const metadata: CodeSessionMetadata = {
        versions: [],
        last_prompt: initial_prompt,
      };

      const { data, error } = await supabase
        .from("content")
        .insert([
          {
            type: "code_session",
            data: name,
            group_id,
            user_id,
            metadata: {
              ...metadata,
              created_by_username: username || "Anonymous",
            },
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Error creating code session:", error);
        throw error;
      }

      return data as Content;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["code-sessions", data.group_id] });
    },
  });
}

// Update code session metadata mutation
export function useUpdateCodeSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      metadata,
    }: {
      sessionId: string;
      metadata: Partial<CodeSessionMetadata>;
    }) => {
      // First fetch the existing session to merge metadata
      const { data: existing, error: fetchError } = await supabase
        .from("content")
        .select("metadata")
        .eq("id", sessionId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const mergedMetadata = {
        ...(existing?.metadata || {}),
        ...metadata,
      };

      const { data, error } = await supabase
        .from("content")
        .update({ metadata: mergedMetadata, updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .select()
        .single();

      if (error) {
        console.error("Error updating code session:", error);
        throw error;
      }

      return data as Content;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["code-session", data.id] });
      queryClient.invalidateQueries({ queryKey: ["code-sessions", data.group_id] });
    },
  });
}

// Delete code session mutation
export function useDeleteCodeSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, groupId }: { sessionId: string; groupId: string }) => {
      const { error } = await supabase
        .from("content")
        .delete()
        .eq("id", sessionId)
        .eq("type", "code_session");

      if (error) {
        console.error("Error deleting code session:", error);
        throw error;
      }

      return { sessionId, groupId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["code-sessions", data.groupId] });
      queryClient.invalidateQueries({ queryKey: ["code-session", data.sessionId] });
    },
  });
}
