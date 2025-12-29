import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useCodeSessionsQuery,
  useCreateCodeSessionMutation,
  useDeleteCodeSessionMutation,
} from "@/hooks/code/use-code-session-queries";
import type { Content } from "@/lib/list/ContentRepository";

interface UseCodeSessionsOptions {
  groupId: string | null;
  userId: string | null;
  username?: string;
}

export function useCodeSessions({ groupId, userId, username }: UseCodeSessionsOptions) {
  const router = useRouter();
  const { data: sessions = [], isLoading, error } = useCodeSessionsQuery(groupId);
  const createMutation = useCreateCodeSessionMutation();
  const deleteMutation = useDeleteCodeSessionMutation();

  const createSession = useCallback(
    async (name: string, initialPrompt?: string): Promise<Content | null> => {
      if (!groupId || !userId) {
        console.error("Cannot create session: missing groupId or userId");
        return null;
      }

      try {
        const session = await createMutation.mutateAsync({
          name,
          group_id: groupId,
          user_id: userId,
          username,
          initial_prompt: initialPrompt,
        });
        return session;
      } catch (error) {
        console.error("Failed to create code session:", error);
        return null;
      }
    },
    [groupId, userId, username, createMutation]
  );

  const deleteSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      if (!groupId) {
        console.error("Cannot delete session: missing groupId");
        return false;
      }

      try {
        await deleteMutation.mutateAsync({ sessionId, groupId });
        return true;
      } catch (error) {
        console.error("Failed to delete code session:", error);
        return false;
      }
    },
    [groupId, deleteMutation]
  );

  const getSessionUrl = useCallback((sessionId: string): string => {
    if (typeof window === "undefined") {
      return `/code/${sessionId}`;
    }
    return `${window.location.origin}/code/${sessionId}`;
  }, []);

  const navigateToSession = useCallback(
    (sessionId: string) => {
      router.push(`/code/${sessionId}`);
    },
    [router]
  );

  const createAndNavigate = useCallback(
    async (name: string, initialPrompt?: string): Promise<void> => {
      const session = await createSession(name, initialPrompt);
      if (session) {
        navigateToSession(session.id);
      }
    },
    [createSession, navigateToSession]
  );

  return {
    sessions,
    isLoading,
    error,
    createSession,
    deleteSession,
    getSessionUrl,
    navigateToSession,
    createAndNavigate,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
