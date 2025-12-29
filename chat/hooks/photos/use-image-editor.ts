"use client";

import { useState, useCallback, useRef } from "react";
import type { PexelsPhoto, CropArea, AspectRatio } from "@/types/photos";

interface UseImageEditorOptions {
  onProcessingComplete?: (blob: Blob) => void;
}

export function useImageEditor(options?: UseImageEditorOptions) {
  const [selectedPhoto, setSelectedPhoto] = useState<PexelsPhoto | null>(null);
  const [crop, setCrop] = useState<CropArea | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("free");
  const [removeBackground, setRemoveBackground] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [bgRemovalProgress, setBgRemovalProgress] = useState(0);
  const [bgRemovedBlob, setBgRemovedBlob] = useState<Blob | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);

  const selectPhoto = useCallback((photo: PexelsPhoto) => {
    setSelectedPhoto(photo);
    setCrop(null);
    setRemoveBackground(false);
    setProcessedImageUrl(null);
    setBgRemovalProgress(0);
    setBgRemovedBlob(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPhoto(null);
    setCrop(null);
    setRemoveBackground(false);
    setProcessedImageUrl(null);
    setBgRemovalProgress(0);
    setBgRemovedBlob(null);
  }, []);

  const applyBackgroundRemoval = useCallback(async (imageUrl: string): Promise<Blob> => {
    setIsProcessing(true);
    setBgRemovalProgress(0);

    try {
      // Lazy load the background removal library
      const { removeBackground: removeBg } = await import("@imgly/background-removal");

      const result = await removeBg(imageUrl, {
        progress: (key, current, total) => {
          if (total > 0) {
            setBgRemovalProgress(Math.round((current / total) * 100));
          }
        },
      });

      return result;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const toggleBackgroundRemoval = useCallback(async (enabled: boolean) => {
    setRemoveBackground(enabled);

    if (enabled && selectedPhoto) {
      // Run background removal immediately and show preview
      try {
        const blob = await applyBackgroundRemoval(selectedPhoto.src.large2x);
        const previewUrl = URL.createObjectURL(blob);
        setProcessedImageUrl(previewUrl);
        setBgRemovedBlob(blob);
      } catch (error) {
        console.error("Background removal failed:", error);
        setRemoveBackground(false);
      }
    } else {
      // Clear preview when disabled
      if (processedImageUrl) {
        URL.revokeObjectURL(processedImageUrl);
      }
      setProcessedImageUrl(null);
      setBgRemovedBlob(null);
    }
  }, [selectedPhoto, applyBackgroundRemoval, processedImageUrl]);

  const applyCrop = useCallback(async (
    imageUrl: string,
    cropArea: CropArea,
    originalWidth: number,
    originalHeight: number
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Convert percentage to pixels if needed
        let x = cropArea.x;
        let y = cropArea.y;
        let width = cropArea.width;
        let height = cropArea.height;

        if (cropArea.unit === "%") {
          x = (cropArea.x / 100) * img.width;
          y = (cropArea.y / 100) * img.height;
          width = (cropArea.width / 100) * img.width;
          height = (cropArea.height / 100) * img.height;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        }, "image/png");
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageUrl;
    });
  }, []);

  const processImage = useCallback(async (): Promise<Blob | null> => {
    if (!selectedPhoto) return null;

    setIsProcessing(true);

    try {
      let currentImageUrl = selectedPhoto.src.large2x;
      let resultBlob: Blob | null = null;

      // If background removal is enabled, use cached blob or apply it
      if (removeBackground) {
        if (bgRemovedBlob) {
          // Use cached result
          resultBlob = bgRemovedBlob;
          currentImageUrl = URL.createObjectURL(resultBlob);
        } else {
          resultBlob = await applyBackgroundRemoval(currentImageUrl);
          currentImageUrl = URL.createObjectURL(resultBlob);
        }
      }

      // If crop is defined, apply it
      if (crop && crop.width > 0 && crop.height > 0) {
        resultBlob = await applyCrop(
          currentImageUrl,
          crop,
          selectedPhoto.width,
          selectedPhoto.height
        );
      }

      // If no processing was done, fetch the original image
      if (!resultBlob) {
        const response = await fetch(selectedPhoto.src.large2x);
        resultBlob = await response.blob();
      }

      options?.onProcessingComplete?.(resultBlob);

      return resultBlob;
    } catch (error) {
      console.error("Image processing error:", error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPhoto, crop, removeBackground, bgRemovedBlob, applyBackgroundRemoval, applyCrop, options]);

  return {
    // State
    selectedPhoto,
    crop,
    aspectRatio,
    removeBackground,
    isProcessing,
    processedImageUrl,
    bgRemovalProgress,
    imageRef,

    // Actions
    selectPhoto,
    clearSelection,
    setCrop,
    setAspectRatio,
    setRemoveBackground,
    toggleBackgroundRemoval,
    processImage,
  };
}
