/**
 * Utility functions for content processing
 */

// URL regex pattern
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

/**
 * Extract all URLs from text content
 */
export function extractUrls(text: string): string[] {
	const urls = text.match(URL_REGEX) || [];
	return [...new Set(urls)]; // Remove duplicates
}

/**
 * Extract YouTube playlist URLs from text
 */
export function extractYouTubePlaylistUrls(text: string): string[] {
	const playlistRegex = /https?:\/\/(?:www\.)?youtube\.com\/(?:watch\?.*list=|playlist\?list=)([\w-]+)/gi;
	const matches = text.matchAll(playlistRegex);
	return Array.from(matches, m => m[0]);
}

/**
 * SEO metadata interface
 */
export interface SEOMetadata {
	title?: string;
	description?: string;
	image?: string;
	favicon?: string;
	domain?: string;
	siteName?: string;
	type?: string;
	url?: string;
}

/**
 * Fetch SEO metadata from a URL by parsing HTML
 */
export async function fetchSEOMetadata(url: string): Promise<SEOMetadata> {
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; ListApp-SEO-Bot/1.0)',
			},
			signal: AbortSignal.timeout(10000),
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const html = await response.text();
		const metadata: SEOMetadata = {
			url: url,
			domain: new URL(url).hostname,
		};

		// Extract title
		const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
		if (titleMatch) {
			metadata.title = titleMatch[1].trim();
		}

		// Extract meta description
		const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
										 html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
		if (descMatch) {
			metadata.description = descMatch[1].trim();
		}

		// Extract Open Graph data
		const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i);
		if (ogTitle && !metadata.title) {
			metadata.title = ogTitle[1].trim();
		}

		const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
		if (ogDesc && !metadata.description) {
			metadata.description = ogDesc[1].trim();
		}

		const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
		if (ogImage) {
			metadata.image = ogImage[1].trim();
			// Convert relative URLs to absolute
			if (metadata.image && !metadata.image.startsWith('http')) {
				metadata.image = new URL(metadata.image, url).toString();
			}
		}

		const ogSiteName = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i);
		if (ogSiteName) {
			metadata.siteName = ogSiteName[1].trim();
		}

		const ogType = html.match(/<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']+)["'][^>]*>/i);
		if (ogType) {
			metadata.type = ogType[1].trim();
		}

		// Extract favicon
		const faviconMatch = html.match(/<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i);
		if (faviconMatch) {
			metadata.favicon = faviconMatch[1].trim();
			// Convert relative URLs to absolute
			if (metadata.favicon && !metadata.favicon.startsWith('http')) {
				metadata.favicon = new URL(metadata.favicon, url).toString();
			}
		}

		return metadata;
	} catch (error) {
		console.error(`Failed to fetch SEO for ${url}:`, error);
		// Return minimal metadata on error
		return {
			url: url,
			domain: new URL(url).hostname,
			title: url, // Fallback to URL as title
		};
	}
}

/**
 * Detect content type from filename extension
 */
export function detectContentType(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase() || '';

	const typeMap: Record<string, string> = {
		'js': 'js',
		'jsx': 'js',
		'ts': 'js',
		'tsx': 'js',
		'py': 'code',
		'go': 'code',
		'rs': 'code',
		'java': 'code',
		'md': 'text',
		'txt': 'text',
		'json': 'code',
		'html': 'code',
		'css': 'code',
		'sql': 'code'
	};

	return typeMap[ext] || 'text';
}
