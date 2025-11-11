export type SocialMediaPlatform =
  | 'twitter'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'linkedin'
  | 'facebook'
  | 'pinterest';

export interface SocialMediaDetectionResult {
  platform: SocialMediaPlatform;
  url: string;
  isValid: boolean;
}

/**
 * Detects if a URL is from a supported social media platform
 * Returns platform type and validated URL
 */
export function detectSocialMediaUrl(url: string): SocialMediaDetectionResult | null {
  if (!url) return null;

  const urlLower = url.toLowerCase();

  // Twitter/X detection
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    // Must contain status ID (not just profile links)
    if (urlLower.includes('/status/')) {
      return {
        platform: 'twitter',
        url: url,
        isValid: true
      };
    }
  }

  // Instagram detection
  if (urlLower.includes('instagram.com')) {
    // Must be a post/reel/p/ URL
    if (urlLower.includes('/p/') || urlLower.includes('/reel/') || urlLower.includes('/tv/')) {
      return {
        platform: 'instagram',
        url: url,
        isValid: true
      };
    }
  }

  // TikTok detection
  if (urlLower.includes('tiktok.com')) {
    // Must contain video ID (not short vm.tiktok.com links)
    if (urlLower.includes('/video/') || urlLower.includes('/@')) {
      return {
        platform: 'tiktok',
        url: url,
        isValid: true
      };
    }
  }

  // YouTube detection
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    // Match various YouTube URL formats
    if (urlLower.includes('watch?v=') ||
        urlLower.includes('youtu.be/') ||
        urlLower.includes('embed/') ||
        urlLower.includes('shorts/')) {
      return {
        platform: 'youtube',
        url: url,
        isValid: true
      };
    }
  }

  // LinkedIn detection
  if (urlLower.includes('linkedin.com')) {
    // Must be a post or article
    if (urlLower.includes('/posts/') ||
        urlLower.includes('/pulse/') ||
        urlLower.includes('feed/update/')) {
      return {
        platform: 'linkedin',
        url: url,
        isValid: true
      };
    }
  }

  // Facebook detection
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.com') || urlLower.includes('fb.watch')) {
    // Must be a post, photo, or video (not just profile pages)
    if (urlLower.includes('/posts/') ||
        urlLower.includes('/photos/') ||
        urlLower.includes('/videos/') ||
        urlLower.includes('/permalink/') ||
        urlLower.includes('fb.watch/')) {
      return {
        platform: 'facebook',
        url: url,
        isValid: true
      };
    }
  }

  // Pinterest detection
  if (urlLower.includes('pinterest.com') || urlLower.includes('pin.it')) {
    // Must be a pin URL with ID (not short links)
    if (urlLower.includes('/pin/') && !urlLower.includes('pin.it')) {
      return {
        platform: 'pinterest',
        url: url,
        isValid: true
      };
    }
  }

  return null;
}

/**
 * Extracts social media URLs from text content
 */
export function extractSocialMediaUrls(text: string): SocialMediaDetectionResult[] {
  if (!text) return [];

  // Simple URL regex - matches http(s)://... or www....
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
  const matches = text.match(urlRegex) || [];

  const results: SocialMediaDetectionResult[] = [];

  for (const match of matches) {
    // Ensure URL has protocol
    const url = match.startsWith('http') ? match : `https://${match}`;
    const detection = detectSocialMediaUrl(url);
    if (detection) {
      results.push(detection);
    }
  }

  return results;
}
