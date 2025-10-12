import { executeGo } from './go-executor.js';
import type { GoRequest } from './go-client.js';

/**
 * Libgen search request parameters
 */
export interface LibgenSearchRequest {
	query: string;
	search_type?: 'default' | 'title' | 'author';
	topics?: string[];
	filters?: Record<string, string>;
}

/**
 * Book information from Libgen search
 */
export interface BookInfo {
	id: string;
	title: string;
	author: string;
	publisher: string;
	year: string;
	language: string;
	pages: string;
	size: string;
	extension: string;
	md5: string;
	mirrors: string[];
}

/**
 * Libgen search response
 */
export interface LibgenSearchResponse {
	books: BookInfo[];
	query: string;
}

/**
 * Type guard for LibgenSearchResponse
 */
export function isLibgenSearchResponse(obj: any): obj is LibgenSearchResponse {
	return (
		obj &&
		typeof obj === 'object' &&
		Array.isArray(obj.books) &&
		typeof obj.query === 'string' &&
		obj.books.every((book: any) =>
			typeof book.id === 'string' &&
			typeof book.title === 'string' &&
			typeof book.author === 'string'
		)
	);
}

/**
 * Search for books on Libgen
 */
export async function searchLibgen(request: LibgenSearchRequest): Promise<BookInfo[]> {
	const goRequest: GoRequest = {
		method: 'libgen.search',
		params: request
	};

	const response = await executeGo(goRequest);

	if (!response.success) {
		throw new Error(`Libgen search failed: ${response.error}`);
	}

	if (!isLibgenSearchResponse(response.result)) {
		throw new Error('Invalid libgen search response format');
	}

	return response.result.books;
}
