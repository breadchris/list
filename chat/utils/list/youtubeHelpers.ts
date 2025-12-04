import { Content } from '../components/ContentRepository';

/**
 * Extract YouTube video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/embed/VIDEO_ID
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    // Standard watch URLs: youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    // Short URLs: youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Embed URLs: youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if content contains a YouTube video URL
 * Returns video ID if found, null otherwise
 *
 * Checks:
 * 1. content.metadata.youtube_video_id (from playlist extraction)
 * 2. URLs in content.data (pasted links)
 */
export function getYouTubeVideoFromContent(content: Content): string | null {
  // First check metadata (highest priority - already validated)
  if (content.metadata?.youtube_video_id) {
    return content.metadata.youtube_video_id;
  }

  // Then check content data for URLs
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const urls = content.data.match(urlPattern) || [];

  for (const url of urls) {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      return videoId;
    }
  }

  return null;
}

/**
 * Extract full YouTube URL from content
 * Returns the first YouTube URL found, or constructs one from video ID
 */
export function getYouTubeUrlFromContent(content: Content): string | null {
  // Check metadata for explicit URL
  if (content.metadata?.youtube_url) {
    return content.metadata.youtube_url;
  }

  // Check metadata for video ID and construct URL
  if (content.metadata?.youtube_video_id) {
    return `https://www.youtube.com/watch?v=${content.metadata.youtube_video_id}`;
  }

  // Extract from content data
  const urlPattern = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})[^\s]*/g;
  const urls = content.data.match(urlPattern);

  return urls?.[0] || null;
}
