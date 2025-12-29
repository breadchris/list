// Reading position types for EPUB tracking

export interface Bookmark {
  id: string;
  cfi: string;
  label?: string;
  note?: string;
  created_at: string;
}

export interface Highlight {
  id: string;
  cfi_range: string;
  text: string;
  color: string;
  note?: string;
  created_at: string;
}

export interface ReadingPosition {
  location: string;
  progress_percent: number;
  last_read_at: string;
  bookmarks: Bookmark[];
  highlights: Highlight[];
}

export interface ReadingPositionMetadata extends ReadingPosition {
  // Additional fields stored in content metadata
}

// Content type constant
export const READING_POSITION_TYPE = "reading-position";
