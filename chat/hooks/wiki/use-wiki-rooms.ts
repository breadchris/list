import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useWikiRoomsQuery,
  useCreateWikiRoomMutation,
  useDeleteWikiRoomMutation,
} from "@/hooks/wiki/use-wiki-room-queries";
import type { Content } from "@/lib/list/ContentRepository";

interface UseWikiRoomsOptions {
  groupId: string | null;
  userId: string | null;
  username?: string;
}

export function useWikiRooms({ groupId, userId, username }: UseWikiRoomsOptions) {
  const router = useRouter();
  const { data: wikis = [], isLoading, error } = useWikiRoomsQuery(groupId);
  const createMutation = useCreateWikiRoomMutation();
  const deleteMutation = useDeleteWikiRoomMutation();

  const createWiki = useCallback(
    async (name: string): Promise<Content | null> => {
      if (!groupId || !userId) {
        console.error("Cannot create wiki: missing groupId or userId");
        return null;
      }

      try {
        const wiki = await createMutation.mutateAsync({
          name,
          group_id: groupId,
          user_id: userId,
          username,
        });
        return wiki;
      } catch (error) {
        console.error("Failed to create wiki:", error);
        return null;
      }
    },
    [groupId, userId, username, createMutation]
  );

  const deleteWiki = useCallback(
    async (wikiId: string): Promise<boolean> => {
      if (!groupId) {
        console.error("Cannot delete wiki: missing groupId");
        return false;
      }

      try {
        await deleteMutation.mutateAsync({ wikiId, groupId });
        return true;
      } catch (error) {
        console.error("Failed to delete wiki:", error);
        return false;
      }
    },
    [groupId, deleteMutation]
  );

  const getWikiUrl = useCallback((wikiId: string): string => {
    if (typeof window === "undefined") {
      return `/wiki/${wikiId}`;
    }
    return `${window.location.origin}/wiki/${wikiId}`;
  }, []);

  const navigateToWiki = useCallback(
    (wikiId: string) => {
      router.push(`/wiki/${wikiId}`);
    },
    [router]
  );

  const createAndNavigate = useCallback(
    async (name: string): Promise<void> => {
      const wiki = await createWiki(name);
      if (wiki) {
        navigateToWiki(wiki.id);
      }
    },
    [createWiki, navigateToWiki]
  );

  return {
    wikis,
    isLoading,
    error,
    createWiki,
    deleteWiki,
    getWikiUrl,
    navigateToWiki,
    createAndNavigate,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
