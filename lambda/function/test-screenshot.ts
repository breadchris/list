import { generateScreenshot } from './src/cloudflare-client.js';
import { writeFileSync } from 'fs';

async function testScreenshot() {
  try {
    console.log('Testing Cloudflare screenshot with wikipedia.com...');
    console.log('Environment variables:');
    console.log(`  CLOUDFLARE_API_KEY: ${process.env.CLOUDFLARE_API_KEY ? 'SET' : 'NOT SET'}`);
    console.log(`  CLOUDFLARE_ACCOUNT_ID: ${process.env.CLOUDFLARE_ACCOUNT_ID ? 'SET' : 'NOT SET'}`);
    console.log('');

    const url = 'https://en.wikipedia.org/wiki/Main_Page';
    console.log(`Fetching screenshot for: ${url}`);

    const screenshot = await generateScreenshot(url);

    // Convert ArrayBuffer to Buffer for Node.js file operations
    const buffer = Buffer.from(screenshot);

    const outputPath = 'test-screenshot.png';
    writeFileSync(outputPath, buffer);

    console.log('');
    console.log('Screenshot saved successfully!');
    console.log(`  Output file: ${outputPath}`);
    console.log(`  File size: ${buffer.length} bytes (${(buffer.length / 1024).toFixed(2)} KB)`);

    // Analyze file size
    if (buffer.length < 1000) {
      console.log('  ⚠️  WARNING: File size is suspiciously small - likely an empty/error image');
    } else if (buffer.length < 10000) {
      console.log('  ⚠️  WARNING: File size is quite small - may be mostly blank');
    } else {
      console.log('  ✓ File size looks reasonable for a screenshot');
    }

  } catch (error) {
    console.error('Error generating screenshot:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

testScreenshot();
