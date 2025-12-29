"use client";

import { useState, useCallback } from "react";
import { X, Download, Upload, Loader2, Check } from "lucide-react";
import { CropTool } from "./components/crop-tool";
import { BackgroundTool } from "./components/background-tool";
import { usePhotoUpload } from "@/hooks/photos/use-photo-upload";
import type { PexelsPhoto, CropArea, AspectRatio } from "@/types/photos";
import { toast } from "sonner";

interface PhotoEditorPanelProps {
  photo: PexelsPhoto;
  onClose: () => void;
  crop: CropArea | null;
  onCropChange: (crop: CropArea | null) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  removeBackground: boolean;
  onRemoveBackgroundChange: (enabled: boolean) => void;
  isProcessing: boolean;
  bgRemovalProgress: number;
  processedImageUrl: string | null;
  processImage: () => Promise<Blob | null>;
}

export function PhotoEditorPanel({
  photo,
  onClose,
  crop,
  onCropChange,
  aspectRatio,
  onAspectRatioChange,
  removeBackground,
  onRemoveBackgroundChange,
  isProcessing,
  bgRemovalProgress,
  processedImageUrl,
  processImage,
}: PhotoEditorPanelProps) {
  const [isExporting, setIsExporting] = useState(false);

  const { uploadPhoto, isUploading, uploadProgress } = usePhotoUpload({
    onSuccess: (contentId, fileUrl) => {
      toast.success(
        <div className="space-y-1">
          <p>Photo saved to your library!</p>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fuchsia-400 hover:underline text-xs break-all block"
          >
            {fileUrl}
          </a>
        </div>,
        { duration: 8000 }
      );
      onClose();
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const blob = await processImage();
      if (blob) {
        await uploadPhoto(blob, photo, {
          cropped: !!crop,
          backgroundRemoved: removeBackground,
        });
      }
    } finally {
      setIsExporting(false);
    }
  }, [processImage, uploadPhoto, photo, crop, removeBackground]);

  const handleDownload = useCallback(async () => {
    setIsExporting(true);
    try {
      const blob = await processImage();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pexels-${photo.id}-edited.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Image downloaded!");
      }
    } finally {
      setIsExporting(false);
    }
  }, [processImage, photo.id]);

  const isBusy = isProcessing || isExporting || isUploading;

  return (
    <div className="h-full flex flex-col bg-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-700">
        <div>
          <h3 className="font-medium text-white">Edit Photo</h3>
          <p className="text-sm text-neutral-400">by {photo.photographer}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Crop Tool */}
        <div>
          <h4 className="text-sm font-medium text-neutral-300 mb-2">Crop</h4>
          <CropTool
            imageUrl={photo.src.large2x}
            aspectRatio={aspectRatio}
            onAspectRatioChange={onAspectRatioChange}
            onCropChange={onCropChange}
          />
        </div>

        {/* Background Removal */}
        <div>
          <h4 className="text-sm font-medium text-neutral-300 mb-2">
            Background
          </h4>
          <BackgroundTool
            enabled={removeBackground}
            onToggle={onRemoveBackgroundChange}
            isProcessing={isProcessing}
            progress={bgRemovalProgress}
          />
        </div>

        {/* Preview of processed image */}
        {processedImageUrl && (
          <div>
            <h4 className="text-sm font-medium text-neutral-300 mb-2">Preview</h4>
            <div
              className="rounded-lg p-2 flex items-center justify-center"
              style={{
                backgroundImage: 'linear-gradient(45deg, #374151 25%, transparent 25%), linear-gradient(-45deg, #374151 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #374151 75%), linear-gradient(-45deg, transparent 75%, #374151 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                backgroundColor: '#1f2937'
              }}
            >
              <img
                src={processedImageUrl}
                alt="Preview with background removed"
                className="max-h-[200px] max-w-full object-contain"
              />
            </div>
          </div>
        )}

        {/* Photo Info */}
        <div className="text-sm text-neutral-400 space-y-1">
          <p>Original size: {photo.width} x {photo.height}</p>
          <p>
            <a
              href={photo.photographer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fuchsia-400 hover:underline"
            >
              View photographer on Pexels
            </a>
          </p>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-neutral-700 space-y-3">
        {isUploading && (
          <div className="w-full bg-neutral-700 rounded-full h-2">
            <div
              className="bg-fuchsia-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-neutral-700 text-neutral-200 rounded-lg hover:bg-neutral-600 disabled:opacity-50"
          >
            {isExporting && !isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download
          </button>
          <button
            onClick={handleExport}
            disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-fuchsia-500 text-white rounded-lg hover:bg-fuchsia-600 disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Save to Library
          </button>
        </div>
      </div>
    </div>
  );
}
