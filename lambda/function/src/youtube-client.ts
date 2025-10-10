import { executeGo } from './go-executor.js';
import type { PlaylistRequest, PlaylistResponse, VideoInfo } from './go-client.js';
import { isPlaylistResponse } from './go-client.js';

/**
 * Get videos from a YouTube playlist URL
 */
export async function getPlaylistVideos(url: string): Promise<VideoInfo[]> {
	const request: PlaylistRequest = { url };

	const response = await executeGo({
		method: 'youtube.playlist',
		params: request
	});

	if (!response.success) {
		throw new Error(`YouTube playlist fetch failed: ${response.error}`);
	}

	if (!isPlaylistResponse(response.result)) {
		throw new Error('Invalid playlist response format');
	}

	return response.result.videos;
}
