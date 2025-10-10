import { z } from 'zod';

// Zod schemas for runtime validation - matches Go struct JSON tags (snake_case)

export const RequestSchema = z.object({
	method: z.string(),
	params: z.unknown()
});

export const ResponseSchema = z.object({
	success: z.boolean(),
	result: z.unknown().optional(),
	error: z.string().optional()
});

export const PlaylistRequestSchema = z.object({
	url: z.string().url()
});

export const ThumbnailSchema = z.object({
	url: z.string(),
	width: z.number(),
	height: z.number()
});

export const VideoInfoSchema = z.object({
	id: z.string(),
	title: z.string(),
	url: z.string().url(),
	duration: z.number(),
	author: z.string(),
	channel_id: z.string(),
	channel_handle: z.string(),
	description: z.string(),
	views: z.number(),
	publish_date: z.string(),
	thumbnails: z.array(ThumbnailSchema)
});

export const PlaylistResponseSchema = z.object({
	videos: z.array(VideoInfoSchema)
});

// TypeScript types - mirrors Go structs with snake_case JSON fields

export interface GoRequest {
	method: string;
	params: unknown;
}

export interface GoResponse {
	success: boolean;
	result?: unknown;
	error?: string;
}

export interface PlaylistRequest {
	url: string;
}

export interface Thumbnail {
	url: string;
	width: number;
	height: number;
}

export interface VideoInfo {
	id: string;
	title: string;
	url: string;
	duration: number;
	author: string;
	channel_id: string;
	channel_handle: string;
	description: string;
	views: number;
	publish_date: string;
	thumbnails: Thumbnail[];
}

export interface PlaylistResponse {
	videos: VideoInfo[];
}

// Type guards

export function isGoResponse(data: unknown): data is GoResponse {
	const result = ResponseSchema.safeParse(data);
	return result.success;
}

export function isPlaylistResponse(data: unknown): data is PlaylistResponse {
	const result = PlaylistResponseSchema.safeParse(data);
	return result.success;
}
