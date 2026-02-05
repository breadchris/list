import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/list/SupabaseClient";
import {
  WIKI_BACKUP_CONTENT_TYPE,
  type WikiBackup,
  type WikiBackupMetadata,
} from "@/types/wiki";

const WIKI_EXPORT_URL = "https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/wiki-export";

interface UseWikiBackupOptions {
  wiki_id: string;
  group_id: string;
  wiki_title: string;
}

interface UseWikiBackupReturn {
  /** List of existing backups (most recent first) */
  backups: WikiBackup[];
  /** Whether a backup exists for today */
  hasTodayBackup: boolean;
  /** Loading backups list */
  isLoading: boolean;
  /** Creating backup in progress */
  isCreating: boolean;
  /** Create a new backup */
  createBackup: (trigger: "manual" | "auto") => Promise<void>;
  /** Error message if any */
  error: string | null;
}

/**
 * Hook for managing wiki backups.
 * Provides backup creation, listing, and daily deduplication.
 *
 * Uses the wiki-export Lambda in Y.js mode - the Lambda connects to Y-Sweet
 * directly and reads page content using BlockNote's yXmlFragmentToBlocks.
 */
export function useWikiBackup({
  wiki_id,
  group_id,
  wiki_title,
}: UseWikiBackupOptions): UseWikiBackupReturn {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = useCallback(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  // Query backups for this wiki
  const {
    data: backups = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["wiki-backups", wiki_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, created_at, metadata")
        .eq("type", WIKI_BACKUP_CONTENT_TYPE)
        .eq("parent_content_id", wiki_id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching backups:", error);
        throw error;
      }

      return (data || []).map((row) => ({
        id: row.id,
        created_at: row.created_at,
        metadata: row.metadata as WikiBackupMetadata,
      })) as WikiBackup[];
    },
    enabled: !!wiki_id,
  });

  // Check if backup exists for today
  const hasTodayBackup = backups.some(
    (backup) => backup.metadata?.backup_date === getTodayDate()
  );

  // Create a backup using Y.js mode (Lambda reads directly from Y-Sweet)
  const createBackup = useCallback(
    async (trigger: "manual" | "auto") => {
      if (isCreating) return;

      // For auto backups, skip if already exists for today
      if (trigger === "auto" && hasTodayBackup) {
        return;
      }

      setIsCreating(true);
      setError(null);

      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("User not authenticated");
        }

        console.log(`[WikiBackup] Creating backup via Lambda (stores directly in Supabase)...`);

        // Call Lambda with store_backup option - Lambda exports pages AND stores directly in Supabase
        const response = await fetch(WIKI_EXPORT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "yjs",
            doc_id: `wiki-${wiki_id}`,
            format: "all",
            store_backup: {
              wiki_id,
              group_id,
              wiki_title,
              user_id: user.id,
              trigger,
            },
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`[WikiBackup] Lambda error: ${response.status}`, text);
          throw new Error(`Export failed: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Export failed");
        }

        const pageCount = result.data?.page_count || 0;
        const backupId = result.data?.backup_id;

        console.log(`[WikiBackup] Backup created: ${backupId} with ${pageCount} pages`);

        // Refresh backups list
        queryClient.invalidateQueries({ queryKey: ["wiki-backups", wiki_id] });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create backup";
        console.error("[WikiBackup] Error creating backup:", err);
        setError(message);
      } finally {
        setIsCreating(false);
      }
    },
    [
      wiki_id,
      group_id,
      wiki_title,
      isCreating,
      hasTodayBackup,
      getTodayDate,
      queryClient,
    ]
  );

  return {
    backups,
    hasTodayBackup,
    isLoading,
    isCreating,
    createBackup,
    error: error || (queryError ? String(queryError) : null),
  };
}
