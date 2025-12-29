export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt: string;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
}

export interface PexelsSearchResponse {
  page: number;
  per_page: number;
  total_results: number;
  photos: PexelsPhoto[];
  next_page?: string;
}

export interface PhotoMetadata {
  file_url: string;
  file_name: string;
  file_type: string;
  pexels_id: number;
  pexels_url: string;
  photographer: string;
  photographer_url: string;
  alt: string;
  original_width: number;
  original_height: number;
  edited: boolean;
  cropped: boolean;
  background_removed: boolean;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
  unit: "px" | "%";
}

export interface EditorState {
  selectedPhoto: PexelsPhoto | null;
  crop: CropArea | null;
  removeBackground: boolean;
  isProcessing: boolean;
  processedImageUrl: string | null;
}

export type AspectRatio = "free" | "1:1" | "16:9" | "4:3" | "3:2";
