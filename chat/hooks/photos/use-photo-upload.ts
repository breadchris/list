"use client";

import { useState, useCallback } from "react";
import { useGlobalGroup } from "@/components/GlobalGroupContext";
import { ContentRepository } from "@/lib/list/ContentRepository";
import type { PexelsPhoto, PhotoMetadata } from "@/types/photos";

interface UsePhotoUploadOptions {
  onSuccess?: (contentId: string, fileUrl: string) => void;
  onError?: (error: Error) => void;
}

export function usePhotoUpload(options?: UsePhotoUploadOptions) {
  const { selectedGroup } = useGlobalGroup();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadPhoto = useCallback(async (
    blob: Blob,
    photo: PexelsPhoto,
    editInfo: { cropped: boolean; backgroundRemoved: boolean }
  ): Promise<string | null> => {
    if (!selectedGroup) {
      options?.onError?.(new Error("No group selected"));
      return null;
    }

    const groupId = selectedGroup.id;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const contentRepository = new ContentRepository();

      // Create content item with photo metadata
      setUploadProgress(20);

      const fileName = `pexels-${photo.id}-${Date.now()}.png`;

      const content = await contentRepository.createContent({
        type: "image",
        data: photo.alt || `Photo by ${photo.photographer}`,
        group_id: groupId,
      });

      setUploadProgress(40);

      // Upload the image blob to storage
      const file = new File([blob], fileName, { type: "image/png" });
      const fileUrl = await contentRepository.uploadImage(file, content.id);

      setUploadProgress(70);

      // Update content with full metadata
      const metadata: PhotoMetadata = {
        file_url: fileUrl,
        file_name: fileName,
        file_type: "image/png",
        pexels_id: photo.id,
        pexels_url: photo.url,
        photographer: photo.photographer,
        photographer_url: photo.photographer_url,
        alt: photo.alt || "",
        original_width: photo.width,
        original_height: photo.height,
        edited: editInfo.cropped || editInfo.backgroundRemoved,
        cropped: editInfo.cropped,
        background_removed: editInfo.backgroundRemoved,
      };

      await contentRepository.updateContent(content.id, {
        data: fileUrl,  // Store the actual Supabase URL
        metadata,
      });

      setUploadProgress(100);
      options?.onSuccess?.(content.id, fileUrl);

      return content.id;
    } catch (error) {
      console.error("Upload error:", error);
      options?.onError?.(error instanceof Error ? error : new Error("Upload failed"));
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [selectedGroup, options]);

  return {
    uploadPhoto,
    isUploading,
    uploadProgress,
  };
}
