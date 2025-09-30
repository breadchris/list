#!/usr/bin/env node

// Test script to verify URL detection and preview functionality
// Manual URL detection test without imports
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+|www\.[^\s<>"{}|\\^`[\]]+)/gi;

function extractUrls(text) {
  const urls = [];
  URL_REGEX.lastIndex = 0;
  let match;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const url = match[0];
    let normalizedUrl = url;
    if (url.startsWith('www.')) {
      normalizedUrl = 'https://' + url;
    }
    urls.push({ url, normalizedUrl, startIndex: match.index, endIndex: URL_REGEX.lastIndex });
  }
  return urls;
}

function containsUrls(text) {
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text);
}

function getFirstUrl(text) {
  const urls = extractUrls(text);
  return urls.length > 0 ? urls[0].normalizedUrl : null;
}

console.log('='.repeat(50));
console.log('   URL DETECTION TEST');
console.log('='.repeat(50));

// Test cases
const testCases = [
  "Check out this site: https://example.com",
  "Visit www.cloudflare.com for more info",
  "Multiple URLs: https://github.com and www.google.com",
  "No URLs in this text at all",
  "Mixed content https://misplaced.design/ with more text",
  "Partial URL like example.com (should not match)"
];

testCases.forEach((text, index) => {
  console.log(`\nTest ${index + 1}: "${text}"`);
  console.log(`Contains URLs: ${containsUrls(text)}`);

  const urls = extractUrls(text);
  if (urls.length > 0) {
    console.log(`Found ${urls.length} URL(s):`);
    urls.forEach(url => {
      console.log(`  - "${url.url}" → "${url.normalizedUrl}"`);
    });
    console.log(`First URL: ${getFirstUrl(text)}`);
  } else {
    console.log('  No URLs found');
  }
});

console.log('\n' + '='.repeat(50));
console.log('🎉 URL Detection Test Complete!');
console.log('\nExpected behavior:');
console.log('- Content with URLs will trigger screenshot generation');
console.log('- Screenshots appear as previews in the content list');
console.log('- Rate limiting is handled with automatic retries');