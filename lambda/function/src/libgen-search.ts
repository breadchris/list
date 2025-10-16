import * as cheerio from 'cheerio';

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

const LIBGEN_MIRROR = 'https://libgen.li';
const SEARCH_PATH = '/index.php';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

/**
 * Build search URL with query parameters
 */
function buildSearchURL(request: LibgenSearchRequest): string {
	const url = new URL(LIBGEN_MIRROR + SEARCH_PATH);
	const params = url.searchParams;

	params.set('req', request.query);
	params.set('res', '100'); // Results per page

	// Set search columns based on search type
	switch (request.search_type) {
		case 'title':
			params.append('columns[]', 'title');
			break;
		case 'author':
			params.append('columns[]', 'author');
			break;
		default:
			// Default search includes multiple columns
			params.append('columns[]', 'title');
			params.append('columns[]', 'author');
			break;
	}

	// Add objects to search
	params.append('objects[]', 'f'); // files
	params.append('objects[]', 'e'); // editions
	params.append('objects[]', 's'); // series
	params.append('objects[]', 'a'); // authors
	params.append('objects[]', 'p'); // publishers
	params.append('objects[]', 'w'); // works

	// Add topics
	const topics = request.topics || ['libgen'];
	topics.forEach(topic => {
		params.append('topics[]', topic);
	});

	// Add filters if provided
	if (request.filters) {
		Object.entries(request.filters).forEach(([key, value]) => {
			params.set(key, value);
		});
	}

	params.set('filesuns', 'all');

	return url.toString();
}

/**
 * Extract mirror links from a table cell
 */
function extractMirrors($: cheerio.Root, cell: any): string[] {
	const mirrors: string[] = [];

	cell.find('a').each((_: number, link: cheerio.Element) => {
		const href = $(link).attr('href');
		if (!href) return;

		// Convert relative URLs to absolute
		let absoluteUrl = href;
		if (href.startsWith('/')) {
			absoluteUrl = LIBGEN_MIRROR + href;
		}

		mirrors.push(absoluteUrl);
	});

	// Pad to 4 mirrors (matching Go implementation)
	while (mirrors.length < 4) {
		mirrors.push('');
	}

	return mirrors;
}

/**
 * Check if a book matches the specified filters
 */
function matchesFilters(book: BookInfo, filters?: Record<string, string>): boolean {
	if (!filters || Object.keys(filters).length === 0) {
		return true;
	}

	for (const [key, value] of Object.entries(filters)) {
		switch (key) {
			case 'year':
				if (book.year !== value) {
					return false;
				}
				break;
			case 'extension':
				if (book.extension.toLowerCase() !== value.toLowerCase()) {
					return false;
				}
				break;
			case 'language':
				if (book.language.toLowerCase() !== value.toLowerCase()) {
					return false;
				}
				break;
		}
	}

	return true;
}

/**
 * Extract books from the HTML table
 */
function extractBooks($: cheerio.Root, request: LibgenSearchRequest): BookInfo[] {
	const books: BookInfo[] = [];

	// Remove all <i> tags first (they interfere with parsing)
	$('i').remove();

	// Find the results table
	const table = $('#tablelibgen');
	if (table.length === 0) {
		console.log('No results table found with ID #tablelibgen');
		console.log('Available table IDs:', $('table[id]').map((_, el) => $(el).attr('id')).get());
		return books;
	}


	// Iterate through table rows (skip header rows with th)
	table.find('tr').each((_, row) => {
		const cells = $(row).find('td');
		if (cells.length < 4) {
			return; // Skip header rows and malformed rows
		}

		// Extract title and ID from first column
		const firstCell = cells.eq(0);

		// Libgen.li uses multiple table structures:
		// Structure 1: <a href="edition.php" data-toggle="tooltip"> with title in tooltip
		let editionLink = firstCell.find('a[href*="edition.php"][data-toggle="tooltip"]').first();
		let tooltipTitle = editionLink.attr('title');
		let title = '';
		let id = '';

		if (tooltipTitle) {
			// Extract title from tooltip (format: "Add/Edit: ...; ID: ...<br>ACTUAL TITLE")
			const parts = tooltipTitle.split('<br>');
			if (parts.length > 1) {
				title = parts[1].trim();
			}

			// Extract ID from tooltip
			const idMatch = tooltipTitle.match(/ID:\s*(\d+)/);
			if (idMatch) {
				id = idMatch[1];
			}
		}

		// Structure 2: <span data-toggle="tooltip"> with title as text (fallback)
		if (!title) {
			const span = firstCell.find('span[data-toggle="tooltip"]').first();
			if (span.length > 0) {
				const spanClone = span.clone();
				spanClone.find('font').remove();
				title = spanClone.text().trim().split('\n')[0].trim();

				const spanTooltip = span.attr('title');
				if (spanTooltip) {
					const fileIdMatch = spanTooltip.match(/File ID:\s*(\d+)/);
					if (fileIdMatch) {
						id = fileIdMatch[1];
					}
				}
			}
		}

		// Structure 3: Plain text fallback
		if (!title) {
			const cellText = firstCell.text().trim();
			title = cellText.split('\n')[0].trim();
		}

		// Extract book data from cells (structure varies by cell count)
		let author = '';
		let publisher = '';
		let year = '';
		let language = '';
		let pages = '';
		let size = '';
		let extension = '';

		if (cells.length >= 9) {
			// 9-cell structure: ID/Title | Author | Publisher | Year | Language | Pages | Size | Extension | Mirrors
			author = cells.eq(1).text().trim();
			publisher = cells.eq(2).text().trim();
			year = cells.eq(3).text().trim();
			language = cells.eq(4).text().trim();
			pages = cells.eq(5).text().trim();
			size = cells.eq(6).text().trim();
			extension = cells.eq(7).text().trim();
		} else if (cells.length >= 5) {
			// 5-cell structure (colspan): Title/Meta | Unknown | Size | Extension | Mirrors
			size = cells.eq(2).text().trim();
			extension = cells.eq(3).text().trim();
		} else {
			// Minimal structure
			size = cells.eq(2)?.text().trim() || '';
			extension = cells.eq(3)?.text().trim() || '';
		}

		// Extract book data
		const book: BookInfo = {
			id: id,
			title: title,
			author: author,
			publisher: publisher,
			year: year,
			language: language,
			pages: pages,
			size: size,
			extension: extension,
			md5: id, // Use ID as MD5
			mirrors: []
		};

		// Extract mirror links (usually last cell)
		const mirrorCellIndex = cells.length - 1;
		if (mirrorCellIndex > 0) {
			book.mirrors = extractMirrors($, cells.eq(mirrorCellIndex));
		}

		// Apply filters if specified
		if (matchesFilters(book, request.filters)) {
			books.push(book);
		}
	});

	return books;
}

/**
 * Search for books on Libgen
 */
export async function searchLibgen(request: LibgenSearchRequest): Promise<BookInfo[]> {
	if (!request.query) {
		throw new Error('Query is required');
	}

	// Set defaults
	if (!request.search_type) {
		request.search_type = 'default';
	}
	if (!request.topics || request.topics.length === 0) {
		request.topics = ['libgen'];
	}

	// Build search URL
	const searchURL = buildSearchURL(request);
	console.log(`Searching Libgen: ${searchURL}`);

	try {
		// Perform HTTP request
		const response = await fetch(searchURL, {
			headers: {
				'User-Agent': USER_AGENT
			},
			signal: AbortSignal.timeout(30000) // 30 second timeout
		});

		if (!response.ok) {
			throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
		}

		const html = await response.text();
		console.log(`Received HTML response, length: ${html.length} bytes`);

		// Save HTML for debugging (only first 5000 chars)
		if (process.env.DEBUG_LIBGEN) {
			console.log('HTML snippet:', html.substring(0, 5000));
		}

		// Parse HTML with cheerio
		const $ = cheerio.load(html);
		console.log(`HTML parsed with cheerio`);

		// Extract books from table
		const books = extractBooks($, request);

		console.log(`Found ${books.length} books for query: ${request.query}`);
		return books;
	} catch (error) {
		console.error('Libgen search failed:', error);
		throw error;
	}
}
