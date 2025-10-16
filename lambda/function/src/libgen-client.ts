import { searchLibgen as searchLibgenDirect, type BookInfo as LibgenBookInfo } from './libgen-search.js';

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
 * Re-export from libgen-search module
 */
export type BookInfo = LibgenBookInfo;

/**
 * Search for books on Libgen
 * Now uses native TypeScript implementation instead of Go binary
 */
export async function searchLibgen(request: LibgenSearchRequest): Promise<BookInfo[]> {
	console.log('Searching Libgen with TypeScript implementation:', request);

	try {
		const books = await searchLibgenDirect(request);
		console.log(`Libgen search completed: found ${books.length} books`);
		return books;
	} catch (error) {
		console.error('Libgen search failed:', error);
		throw new Error(`Libgen search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
