/**
 * Direct test of TypeScript libgen search implementation
 * Run with: npx tsx test-libgen-direct.ts
 */
import { searchLibgen } from './src/libgen-search.js';

async function test() {
	console.log('🧪 Testing TypeScript Libgen Search Implementation\n');

	try {
		const results = await searchLibgen({
			query: 'python',
			search_type: 'title',
			topics: ['libgen']
		});

		console.log(`✅ Search completed successfully!`);
		console.log(`Found ${results.length} books\n`);

		if (results.length > 0) {
			console.log('First 3 results:');
			results.slice(0, 3).forEach((book, i) => {
				console.log(`\n${i + 1}. ${book.title}`);
				console.log(`   Author: ${book.author}`);
				console.log(`   Year: ${book.year}`);
				console.log(`   Publisher: ${book.publisher}`);
				console.log(`   Extension: ${book.extension}`);
				console.log(`   Size: ${book.size}`);
			});
		}

		process.exit(0);
	} catch (error) {
		console.error('❌ Test failed:', error);
		process.exit(1);
	}
}

test();
