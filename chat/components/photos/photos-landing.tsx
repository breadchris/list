"use client";

import { PhotoSearchPanel } from "./photo-search-panel";
import { PhotoEditorPanel } from "./photo-editor-panel";
import { useImageEditor } from "@/hooks/photos/use-image-editor";
import { Camera } from "lucide-react";

export function PhotosLanding() {
  const {
    selectedPhoto,
    crop,
    aspectRatio,
    removeBackground,
    isProcessing,
    processedImageUrl,
    bgRemovalProgress,
    selectPhoto,
    clearSelection,
    setCrop,
    setAspectRatio,
    toggleBackgroundRemoval,
    processImage,
  } = useImageEditor();

  return (
    <div className="h-full flex">
      {/* Search Panel */}
      <div
        className={`${
          selectedPhoto ? "w-1/2 border-r border-neutral-700" : "w-full"
        } transition-all duration-300`}
      >
        <PhotoSearchPanel
          onSelectPhoto={selectPhoto}
          selectedPhotoId={selectedPhoto?.id}
        />
      </div>

      {/* Editor Panel */}
      {selectedPhoto && (
        <div className="w-1/2">
          <PhotoEditorPanel
            photo={selectedPhoto}
            onClose={clearSelection}
            crop={crop}
            onCropChange={setCrop}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            removeBackground={removeBackground}
            onRemoveBackgroundChange={toggleBackgroundRemoval}
            isProcessing={isProcessing}
            bgRemovalProgress={bgRemovalProgress}
            processedImageUrl={processedImageUrl}
            processImage={processImage}
          />
        </div>
      )}

      {/* Empty State - shown when no photo selected and no search results */}
      {!selectedPhoto && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center opacity-30">
            <Camera className="w-24 h-24 text-neutral-500 mx-auto mb-4" />
            <p className="text-neutral-400 text-lg">
              Search for photos to get started
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
