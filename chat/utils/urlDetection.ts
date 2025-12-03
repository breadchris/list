// URL detection utility - extracted from LinkifiedText.tsx for reuse
// URL detection regex - matches http/https URLs and www domains
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+|www\.[^\s<>"{}|\\^`[\]]+)/gi;

export interface DetectedUrl {
  url: string;
  normalizedUrl: string; // URL with protocol added if missing
  startIndex: number;
  endIndex: number;
}

/**
 * Extracts all URLs from a text string
 * @param text The text to search for URLs
 * @returns Array of detected URLs with their positions
 */
export function extractUrls(text: string): DetectedUrl[] {
  const urls: DetectedUrl[] = [];
  URL_REGEX.lastIndex = 0; // Reset regex state

  let match;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const url = match[0];
    let normalizedUrl = url;

    // Add protocol if missing for www URLs
    if (url.startsWith('www.')) {
      normalizedUrl = 'https://' + url;
    }

    urls.push({
      url,
      normalizedUrl,
      startIndex: match.index,
      endIndex: URL_REGEX.lastIndex
    });
  }

  return urls;
}

/**
 * Checks if text contains any URLs
 * @param text The text to check
 * @returns True if text contains URLs
 */
export function containsUrls(text: string): boolean {
  URL_REGEX.lastIndex = 0; // Reset regex state
  return URL_REGEX.test(text);
}

/**
 * Gets the first URL found in text
 * @param text The text to search
 * @returns The first normalized URL found, or null if none
 */
export function getFirstUrl(text: string): string | null {
  const urls = extractUrls(text);
  return urls.length > 0 ? urls[0].normalizedUrl : null;
}