#!/usr/bin/env node

const WORKER_URL = 'https://content-worker.chrislegolife.workers.dev';

async function testPortfolioSite() {
  console.log('🎨 Testing Screenshot Worker with Portfolio Site...\n');

  const sites = [
    { name: 'Example.com', url: 'https://example.com' },
    { name: 'Cloudflare', url: 'https://cloudflare.com' },
    { name: 'HTTPBin', url: 'https://httpbin.org/html' }
  ];

  for (const site of sites) {
    const contentId = `portfolio-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    console.log(`\n📸 Taking screenshot of ${site.name}`);
    console.log(`   URL: ${site.url}`);
    console.log(`   ID:  ${contentId}`);

    try {
      const startTime = Date.now();
      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: site.url,
          contentId: contentId
        })
      });

      const elapsed = Date.now() - startTime;
      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`   ✅ Success! (${elapsed}ms)`);
        console.log(`   📂 Saved to: ${result.screenshot_url}`);
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 All tests completed!');
  console.log('💡 Check your Supabase storage bucket to see the screenshots');
}

console.log('='.repeat(50));
console.log('   PORTFOLIO SCREENSHOT BATCH TEST');
console.log('='.repeat(50));

testPortfolioSite();