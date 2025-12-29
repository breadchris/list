"use client";

import { useState, useCallback } from "react";
import ReactCrop, { type Crop, type PixelCrop, type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { AspectRatio, CropArea } from "@/types/photos";

interface CropToolProps {
  imageUrl: string;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onCropChange: (crop: CropArea | null) => void;
  onImageLoad?: (img: HTMLImageElement) => void;
}

const aspectRatioValues: Record<AspectRatio, number | undefined> = {
  free: undefined,
  "1:1": 1,
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "3:2": 3 / 2,
};

export function CropTool({
  imageUrl,
  aspectRatio,
  onAspectRatioChange,
  onCropChange,
  onImageLoad,
}: CropToolProps) {
  const [crop, setCrop] = useState<Crop>();

  const handleCropChange = useCallback(
    (pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
      setCrop(percentCrop);
      if (percentCrop.width && percentCrop.height) {
        onCropChange({
          x: percentCrop.x || 0,
          y: percentCrop.y || 0,
          width: percentCrop.width,
          height: percentCrop.height,
          unit: "%",
        });
      } else {
        onCropChange(null);
      }
    },
    [onCropChange]
  );

  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      onImageLoad?.(e.currentTarget);
    },
    [onImageLoad]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-400">Aspect Ratio:</span>
        <div className="flex gap-1">
          {(Object.keys(aspectRatioValues) as AspectRatio[]).map((ratio) => (
            <button
              key={ratio}
              onClick={() => {
                onAspectRatioChange(ratio);
                setCrop(undefined);
                onCropChange(null);
              }}
              className={`px-2 py-1 text-xs rounded ${
                aspectRatio === ratio
                  ? "bg-fuchsia-500 text-white"
                  : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
              }`}
            >
              {ratio === "free" ? "Free" : ratio}
            </button>
          ))}
        </div>
      </div>

      <div className="relative bg-neutral-900 rounded-lg overflow-hidden flex items-center justify-center">
        <ReactCrop
          crop={crop}
          onChange={handleCropChange}
          aspect={aspectRatioValues[aspectRatio]}
          className="max-h-[400px]"
        >
          <img
            src={imageUrl}
            alt="Edit"
            onLoad={handleImageLoad}
            className="max-h-[400px] w-auto"
            crossOrigin="anonymous"
          />
        </ReactCrop>
      </div>

      {crop && crop.width && crop.height && (
        <div className="text-sm text-neutral-400">
          Crop: {Math.round(crop.width)}
          {crop.unit === "%" ? "%" : "px"} x {Math.round(crop.height)}
          {crop.unit === "%" ? "%" : "px"}
        </div>
      )}
    </div>
  );
}
