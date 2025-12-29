import { useCallback, useState } from "react";
import { supabase } from "@/components/SupabaseClient";

interface UseStorageUploadOptions {
  /** Existing content ID to upload to */
  contentId?: string;
  /** Group ID to create content in (if no contentId) */
  groupId?: string;
  /** Callback when draft content is created */
  onContentCreated?: (id: string) => void;
}

/**
 * Hook for uploading files to Supabase storage with RLS-compliant paths.
 *
 * The storage RLS policy requires uploads to use a valid content UUID as the
 * folder name. This hook handles:
 * 1. Using an existing content ID if provided
 * 2. Creating a draft content item on-demand if needed
 * 3. Always uploading to RLS-compliant paths
 */
export function useStorageUpload(options: UseStorageUploadOptions) {
  const { contentId, groupId, onContentCreated } = options;
  const [draftContentId, setDraftContentId] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      // Use provided contentId, or previously created draft
      let uploadFolder = contentId || draftContentId;

      // If no valid folder yet, create a draft content item
      if (!uploadFolder) {
        if (!groupId) {
          throw new Error("No group selected for upload");
        }

        const { data, error } = await supabase
          .from("content")
          .insert({
            group_id: groupId,
            data: "",
            content_type: "draft",
          })
          .select("id")
          .single();

        if (error || !data) {
          console.error("Failed to create upload destination:", error);
          throw new Error("Failed to create upload destination");
        }

        uploadFolder = data.id;
        setDraftContentId(data.id);
        onContentCreated?.(data.id);
      }

      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${uploadFolder}/${timestamp}-${sanitizedName}`;

      const { error } = await supabase.storage
        .from("content")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (error) {
        console.error("Upload failed:", error);
        throw error;
      }

      const { data: urlData } = supabase.storage
        .from("content")
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    },
    [contentId, draftContentId, groupId, onContentCreated]
  );

  return { uploadFile, draftContentId };
}
