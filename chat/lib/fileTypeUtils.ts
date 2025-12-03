/**
 * File type detection and utilities for file uploads
 */

export type ContentFileType = 'epub' | 'pdf' | 'image' | 'audio' | 'video' | 'file';

/**
 * Determine the content type based on file MIME type
 *
 * @param file - File object to analyze
 * @returns Content type string for database storage
 */
export function getContentTypeFromFile(file: File): ContentFileType {
  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  // EPUB
  if (mimeType === 'application/epub+zip' || fileName.endsWith('.epub')) {
    return 'epub';
  }

  // PDF
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return 'pdf';
  }

  // Images
  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  // Audio
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }

  // Video
  if (mimeType.startsWith('video/')) {
    return 'video';
  }

  // Generic file
  return 'file';
}

/**
 * Get file extension from filename
 *
 * @param filename - Name of the file
 * @returns File extension without dot, or 'bin' if no extension
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts.pop()!.toLowerCase();
  }
  return 'bin';
}

/**
 * Sanitize filename for safe storage
 * Removes special characters and limits length
 *
 * @param filename - Original filename
 * @returns Sanitized filename safe for URLs and storage
 */
export function sanitizeFilename(filename: string): string {
  // Replace spaces with hyphens
  let sanitized = filename.replace(/\s+/g, '-');

  // Remove special characters except dots, hyphens, underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9.-_]/g, '');

  // Limit length to 200 characters
  if (sanitized.length > 200) {
    const ext = getFileExtension(sanitized);
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
    sanitized = nameWithoutExt.substring(0, 200 - ext.length - 1) + '.' + ext;
  }

  return sanitized;
}

/**
 * Format file size for display
 *
 * @param bytes - File size in bytes
 * @returns Formatted string like "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get emoji icon for file type
 *
 * @param type - Content file type
 * @returns Emoji string
 */
export function getFileTypeEmoji(type: ContentFileType): string {
  const emojiMap: Record<ContentFileType, string> = {
    epub: '📚',
    pdf: '📄',
    image: '🖼️',
    audio: '🎵',
    video: '🎬',
    file: '📎',
  };

  return emojiMap[type] || '📎';
}

/**
 * Get display label for file type
 *
 * @param type - Content file type
 * @returns Human-readable label
 */
export function getFileTypeLabel(type: ContentFileType): string {
  const labelMap: Record<ContentFileType, string> = {
    epub: 'EPUB Book',
    pdf: 'PDF Document',
    image: 'Image',
    audio: 'Audio',
    video: 'Video',
    file: 'File',
  };

  return labelMap[type] || 'File';
}

/**
 * Check if file type supports preview
 *
 * @param type - Content file type
 * @returns true if preview is supported
 */
export function supportsPreview(type: ContentFileType): boolean {
  return type === 'image' || type === 'pdf';
}

/**
 * Get action label for file type
 *
 * @param type - Content file type
 * @returns Action button label
 */
export function getFileActionLabel(type: ContentFileType): string {
  const actionMap: Record<ContentFileType, string> = {
    epub: 'Open in Reader',
    pdf: 'View',
    image: 'View',
    audio: 'Play',
    video: 'Play',
    file: 'Download',
  };

  return actionMap[type] || 'Download';
}
