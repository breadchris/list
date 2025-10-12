import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { DatabaseHelper } from './helpers/database-helper';

test.describe('Lambda SEO Extraction Workflow', () => {
  let authHelper: AuthHelper;
  let dbHelper: DatabaseHelper;
  let testUser: any;
  let testGroupId: string;
  let testContentId: string;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper();
    dbHelper = new DatabaseHelper();

    // Create test user
    const email = `lambda-seo-${Date.now()}@test.com`;
    testUser = await authHelper.createTestUser(email);

    // Create a test group
    testGroupId = await dbHelper.createTestGroup({
      name: 'Lambda SEO Test Group',
      user_id: testUser.id
    });

    // Create test content with a URL
    testContentId = await dbHelper.createTestContent({
      type: 'text',
      data: 'Check out this article: https://example.com',
      group_id: testGroupId,
      user_id: testUser.id,
      parent_content_id: null
    });

    // Login
    await authHelper.loginProgrammatically(page, testUser.email, testUser.password);

    // Navigate to the group
    await page.goto(`/?g=${testGroupId}`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    // Cleanup
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

  test('should extract SEO metadata via Lambda', async ({ page }) => {
    console.log('🧪 Testing Lambda SEO Extraction Workflow');

    // Find the test content item
    const contentItem = page.locator(`[data-content-id="${testContentId}"]`).first();
    await expect(contentItem).toBeVisible({ timeout: 10000 });

    // Select the content item
    await contentItem.click();
    console.log('✓ Content item selected');

    // Look for SEO extract action button/menu
    const moreButton = page.locator('button:has-text("More")').or(
      page.locator('[data-testid="context-menu-button"]')
    ).first();

    if (await moreButton.isVisible()) {
      await moreButton.click();
      await page.waitForTimeout(500);
    }

    // Click SEO Extract button
    const seoExtractButton = page.locator('button:has-text("Extract SEO")').or(
      page.locator('[data-testid="seo-extract-button"]')
    ).first();

    await expect(seoExtractButton).toBeVisible({ timeout: 5000 });
    await seoExtractButton.click();
    console.log('✓ SEO Extract initiated');

    // Wait for Lambda API call to complete
    // Look for success toast or new content item
    const successIndicator = page.locator('text=/SEO.*extracted|Extraction.*complete/i').or(
      page.locator('[data-testid="seo-success-toast"]')
    );

    await expect(successIndicator).toBeVisible({ timeout: 30000 });
    console.log('✓ SEO extraction completed');

    // Verify new SEO content was created
    const seoContent = await dbHelper.getContentByParentId(testContentId);
    expect(seoContent.length).toBeGreaterThan(0);

    const seoItem = seoContent.find(item => item.metadata?.url === 'https://example.com');
    expect(seoItem).toBeDefined();
    expect(seoItem?.metadata).toHaveProperty('title');

    console.log('✅ Lambda SEO extraction workflow validated');
  });

  test('should handle SEO extraction errors gracefully', async ({ page }) => {
    console.log('🧪 Testing Lambda SEO error handling');

    // Create content with invalid URL
    const invalidContentId = await dbHelper.createTestContent({
      type: 'text',
      data: 'Invalid URL test: not-a-valid-url',
      group_id: testGroupId,
      user_id: testUser.id,
      parent_content_id: null
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select invalid content
    const invalidContent = page.locator(`[data-content-id="${invalidContentId}"]`).first();
    await invalidContent.click();

    // Try to extract SEO
    const moreButton = page.locator('button:has-text("More")').first();
    if (await moreButton.isVisible()) {
      await moreButton.click();
    }

    const seoExtractButton = page.locator('button:has-text("Extract SEO")').first();
    await seoExtractButton.click();

    // Should show error message
    const errorToast = page.locator('text=/error|failed|invalid/i').or(
      page.locator('[role="alert"]')
    );

    await expect(errorToast).toBeVisible({ timeout: 10000 });

    // Cleanup
    await dbHelper.deleteTestContent(invalidContentId);

    console.log('✅ Lambda SEO error handling validated');
  });

  test('should extract SEO from multiple URLs', async ({ page }) => {
    console.log('🧪 Testing batch SEO extraction');

    // Create content with multiple URLs
    const multiUrlContentId = await dbHelper.createTestContent({
      type: 'text',
      data: 'Multiple URLs: https://example.com and https://example.org',
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

    const seoExtractButton = page.locator('button:has-text("Extract SEO")').first();
    await seoExtractButton.click();

    // Wait for completion
    await page.waitForTimeout(5000);

    // Verify multiple SEO items created
    const seoContent = await dbHelper.getContentByParentId(multiUrlContentId);
    expect(seoContent.length).toBeGreaterThanOrEqual(2);

    // Cleanup
    await dbHelper.deleteTestContent(multiUrlContentId);

    console.log('✅ Batch SEO extraction validated');
  });
});
