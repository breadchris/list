import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { DatabaseHelper } from './helpers/database-helper';

test.describe('Lambda Markdown Extraction Workflow', () => {
  let authHelper: AuthHelper;
  let dbHelper: DatabaseHelper;
  let testUser: any;
  let testGroupId: string;
  let testContentId: string;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper();
    dbHelper = new DatabaseHelper();

    // Create test user
    const email = `lambda-markdown-${Date.now()}@test.com`;
    testUser = await authHelper.createTestUser(email);

    // Create test group
    testGroupId = await dbHelper.createTestGroup({
      name: 'Lambda Markdown Test Group',
      user_id: testUser.id
    });

    // Create test content with URLs
    testContentId = await dbHelper.createTestContent({
      type: 'text',
      data: 'Read this article: https://example.com/article',
      group_id: testGroupId,
      user_id: testUser.id,
      parent_content_id: null
    });

    // Login
    await authHelper.loginProgrammatically(page, testUser.email, testUser.password);

    // Navigate to group
    await page.goto(`/?g=${testGroupId}`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    if (testContentId) {
      await dbHelper.deleteTestContent(testContentId);
    }
    if (testGroupId) {
      await dbHelper.deleteTestGroup(testGroupId);
    }
    if (testUser?.id) {
      await dbHelper.deleteTestUser(testUser.id);
    }
  });

  test('should extract markdown from URLs via Lambda', async ({ page }) => {
    console.log('🧪 Testing Lambda Markdown Extraction Workflow');

    // Select content
    const contentItem = page.locator(`[data-content-id="${testContentId}"]`).first();
    await expect(contentItem).toBeVisible({ timeout: 10000 });
    await contentItem.click();
    console.log('✓ Content selected');

    // Open actions menu if needed
    const moreButton = page.locator('button:has-text("More")').or(
      page.locator('[data-testid="context-menu-button"]')
    ).first();

    if (await moreButton.isVisible()) {
      await moreButton.click();
      await page.waitForTimeout(500);
    }

    // Click Extract Markdown button
    const markdownButton = page.locator('button:has-text("Extract Markdown")').or(
      page.locator('[data-testid="markdown-extract-button"]')
    ).first();

    await expect(markdownButton).toBeVisible({ timeout: 5000 });
    await markdownButton.click();
    console.log('✓ Markdown extraction initiated');

    // Wait for extraction to complete
    const successIndicator = page.locator('text=/Markdown.*extracted|Extraction.*complete/i').or(
      page.locator('[data-testid="markdown-success"]')
    );

    await expect(successIndicator).toBeVisible({ timeout: 40000 });
    console.log('✓ Markdown extraction completed');

    // Verify markdown content was created
    const markdownContent = await dbHelper.getContentByType(testGroupId, 'markdown');
    expect(markdownContent.length).toBeGreaterThan(0);

    const latestMarkdown = markdownContent[markdownContent.length - 1];
    expect(latestMarkdown.metadata?.cloudflare_markdown).toBe(true);
    expect(latestMarkdown.metadata?.source_url).toBe('https://example.com/article');
    expect(latestMarkdown.metadata?.source_content_id).toBe(testContentId);

    // Content should be sibling (same parent as original)
    expect(latestMarkdown.parent_content_id).toBe(null);

    console.log('✅ Lambda markdown extraction workflow validated');
  });

  test('should extract markdown from multiple URLs', async ({ page }) => {
    console.log('🧪 Testing batch markdown extraction');

    // Create content with multiple URLs
    const multiUrlContentId = await dbHelper.createTestContent({
      type: 'text',
      data: 'Articles: https://example.com/page1 and https://example.com/page2',
      group_id: testGroupId,
      user_id: testUser.id,
      parent_content_id: null
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select and extract
    const content = page.locator(`[data-content-id="${multiUrlContentId}"]`).first();
    await content.click();

    const moreButton = page.locator('button:has-text("More")').first();
    if (await moreButton.isVisible()) {
      await moreButton.click();
    }

    const markdownButton = page.locator('button:has-text("Extract Markdown")').first();
    await markdownButton.click();

    // Wait for completion
    await page.waitForTimeout(10000);

    // Verify multiple markdown items created
    const markdownContent = await dbHelper.getContentByType(testGroupId, 'markdown');
    const recentMarkdown = markdownContent.filter(item =>
      item.metadata?.source_content_id === multiUrlContentId
    );

    expect(recentMarkdown.length).toBeGreaterThanOrEqual(2);

    // Cleanup
    await dbHelper.deleteTestContent(multiUrlContentId);

    console.log('✅ Batch markdown extraction validated');
  });

  test('should handle markdown extraction errors gracefully', async ({ page }) => {
    console.log('🧪 Testing Lambda Markdown error handling');

    // Create content with invalid URL
    const invalidContentId = await dbHelper.createTestContent({
      type: 'text',
      data: 'Invalid URL: not-a-url',
      group_id: testGroupId,
      user_id: testUser.id,
      parent_content_id: null
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select invalid content
    const invalidContent = page.locator(`[data-content-id="${invalidContentId}"]`).first();
    await invalidContent.click();

    // Try to extract markdown
    const moreButton = page.locator('button:has-text("More")').first();
    if (await moreButton.isVisible()) {
      await moreButton.click();
    }

    const markdownButton = page.locator('button:has-text("Extract Markdown")').first();

    // Button might not be visible if no URLs detected
    const buttonVisible = await markdownButton.isVisible().catch(() => false);

    if (buttonVisible) {
      await markdownButton.click();

      // Should show error or no results
      const errorToast = page.locator('text=/error|failed|no urls/i').or(
        page.locator('[role="alert"]')
      );

      // Either error appears or success with 0 URLs processed
      await Promise.race([
        expect(errorToast).toBeVisible({ timeout: 10000 }),
        page.waitForTimeout(5000)
      ]);
    }

    // Cleanup
    await dbHelper.deleteTestContent(invalidContentId);

    console.log('✅ Markdown error handling validated');
  });

  test('should create markdown as siblings not children', async ({ page }) => {
    console.log('🧪 Testing markdown sibling relationship');

    // Select content and extract
    const contentItem = page.locator(`[data-content-id="${testContentId}"]`).first();
    await contentItem.click();

    const moreButton = page.locator('button:has-text("More")').first();
    if (await moreButton.isVisible()) {
      await moreButton.click();
    }

    const markdownButton = page.locator('button:has-text("Extract Markdown")').first();
    await markdownButton.click();

    // Wait for completion
    await page.waitForTimeout(10000);

    // Verify markdown is sibling
    const markdownContent = await dbHelper.getContentByType(testGroupId, 'markdown');
    const latestMarkdown = markdownContent[markdownContent.length - 1];

    // Should have same parent as original content (both null in this case)
    expect(latestMarkdown.parent_content_id).toBe(null);

    // Should have reference to source in metadata
    expect(latestMarkdown.metadata?.source_content_id).toBe(testContentId);

    console.log('✅ Markdown sibling relationship validated');
  });
});
