import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const WORKER_URL = 'https://content-worker.chrislegolife.workers.dev';
const SUPABASE_URL = 'https://zazsrepfnamdmibcyenx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTI5NjI3MywiZXhwIjoyMDcwODcyMjczfQ.dqaqUakGZJfrUibVNjGrTmphbUy1-KwbbuAiWkxGOcc';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

test.describe('Screenshot Worker Tests', () => {

  test('should successfully take a screenshot and upload to Supabase', async ({ request }) => {
    // Generate a unique contentId for this test
    const contentId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Make request to worker
    const response = await request.post(WORKER_URL, {
      data: {
        url: 'https://example.com',
        contentId: contentId
      }
    });

    // Check response status
    expect(response.status()).toBe(200);

    // Parse response body
    const responseBody = await response.json();

    // Verify response structure
    expect(responseBody).toHaveProperty('success', true);
    expect(responseBody).toHaveProperty('screenshot_url');
    expect(responseBody.screenshot_url).toBe(`public/${contentId}.png`);

    // Verify file exists in Supabase storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('content')
      .download(`public/${contentId}.png`);

    expect(fileError).toBeNull();
    expect(fileData).toBeDefined();
    expect(fileData?.size).toBeGreaterThan(0);

    // Verify it's a PNG file by checking the magic bytes
    const arrayBuffer = await fileData!.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // PNG files start with these bytes: 137 80 78 71 13 10 26 10
    expect(bytes[0]).toBe(137);
    expect(bytes[1]).toBe(80);
    expect(bytes[2]).toBe(78);
    expect(bytes[3]).toBe(71);

    // Clean up: delete the test file
    await supabase.storage
      .from('content')
      .remove([`public/${contentId}.png`]);
  });

  test('should take screenshot of a complex website', async ({ request }) => {
    const contentId = `test-complex-${Date.now()}`;

    const response = await request.post(WORKER_URL, {
      data: {
        url: 'https://cloudflare.com',
        contentId: contentId
      }
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    expect(responseBody.success).toBe(true);
    expect(responseBody.screenshot_url).toBe(`public/${contentId}.png`);

    // Verify the screenshot is reasonably large (complex page)
    const { data: fileData } = await supabase.storage
      .from('content')
      .download(`public/${contentId}.png`);

    expect(fileData).toBeDefined();
    expect(fileData?.size).toBeGreaterThan(10000); // At least 10KB

    // Clean up
    await supabase.storage
      .from('content')
      .remove([`public/${contentId}.png`]);
  });

  test('should return error for invalid URL', async ({ request }) => {
    const response = await request.post(WORKER_URL, {
      data: {
        url: 'not-a-valid-url',
        contentId: 'test-invalid-url'
      }
    });

    expect(response.status()).toBe(400);

    const responseBody = await response.json();
    expect(responseBody.success).toBe(false);
    expect(responseBody.error).toContain('Invalid URL');
  });

  test('should return error for missing parameters', async ({ request }) => {
    const response = await request.post(WORKER_URL, {
      data: {
        url: 'https://example.com'
        // Missing contentId
      }
    });

    expect(response.status()).toBe(400);

    const responseBody = await response.json();
    expect(responseBody.success).toBe(false);
    expect(responseBody.error).toContain('Missing required parameters');
  });

  test('should handle GET request with error', async ({ request }) => {
    const response = await request.get(WORKER_URL);

    expect(response.status()).toBe(405);

    const responseBody = await response.json();
    expect(responseBody.success).toBe(false);
    expect(responseBody.error).toContain('Method not allowed');
  });

  test('should overwrite existing screenshot with upsert', async ({ request }) => {
    const contentId = `test-upsert-${Date.now()}`;

    // First screenshot
    const response1 = await request.post(WORKER_URL, {
      data: {
        url: 'https://example.com',
        contentId: contentId
      }
    });
    expect(response1.status()).toBe(200);

    // Get first file size
    const { data: file1 } = await supabase.storage
      .from('content')
      .download(`public/${contentId}.png`);
    const size1 = file1?.size;

    // Second screenshot with different URL (should overwrite)
    const response2 = await request.post(WORKER_URL, {
      data: {
        url: 'https://httpbin.org/html',
        contentId: contentId
      }
    });
    expect(response2.status()).toBe(200);

    // Get second file size
    const { data: file2 } = await supabase.storage
      .from('content')
      .download(`public/${contentId}.png`);
    const size2 = file2?.size;

    // Sizes should be different (different pages)
    expect(size1).toBeDefined();
    expect(size2).toBeDefined();
    expect(size1).not.toBe(size2);

    // Clean up
    await supabase.storage
      .from('content')
      .remove([`public/${contentId}.png`]);
  });
});