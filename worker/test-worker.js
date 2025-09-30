#!/usr/bin/env node

const WORKER_URL = 'https://content-worker.chrislegolife.workers.dev';

async function testWorker() {
  console.log('🧪 Testing Screenshot Worker...\n');

  const contentId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  console.log(`📸 Taking screenshot of https://example.com`);
  console.log(`📝 Using contentId: ${contentId}`);

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://example.com',
        contentId: contentId
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('\n✅ SUCCESS!');
      console.log('📂 Screenshot uploaded to:', result.screenshot_url);
      console.log('\n🎉 Worker is functioning correctly!');

      console.log('\n📊 Full response:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n❌ FAILED!');
      console.log('Error:', result.error || 'Unknown error');
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.log('\n❌ Request failed!');
    console.log('Error:', error.message);
  }
}

console.log('='.repeat(50));
console.log('   CLOUDFLARE WORKER SCREENSHOT TEST');
console.log('='.repeat(50));

testWorker();