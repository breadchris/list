import { test, expect } from '@playwright/test';
import { TestDataGenerator } from './helpers/test-data-generator';
import { DatabaseHelper } from './helpers/database-helper';

test.describe('Sticky Navbar Functionality', () => {
  let testData: TestDataGenerator;
  let databaseHelper: DatabaseHelper;

  test.beforeEach(async ({ page }) => {
    testData = new TestDataGenerator();
    databaseHelper = new DatabaseHelper();
  });

  test.afterEach(async () => {
    // Cleanup handled by test setup
  });

  test('navbar should remain fixed at top when scrolling in main app', async ({ page }) => {
    // Setup test user and group with content
    const user = await testData.createTestUser();
    const group = await testData.createTestGroup(user.id, 'Scroll Test Group');

    // Create multiple content items to ensure scrollable content
    const contentItems = [];
    for (let i = 0; i < 20; i++) {
      const content = await testData.createTestContent(
        group.id,
        user.id,
        `Test content item ${i + 1} - This is a longer text content to make the page scrollable and test the navbar behavior when scrolling through the content list.`
      );
      contentItems.push(content);
    }

    // Navigate to app
    await page.goto('/');

    // Mock authentication
    await page.evaluate((testUser) => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: testUser.id, email: testUser.email }
      }));
    }, { id: user.id, email: user.email });

    await page.reload();
    await page.waitForSelector('[data-testid="main-app"]');

    // Wait for content to load
    await page.waitForSelector('header');
    await page.waitForTimeout(1000); // Allow content to render

    // Get header element
    const header = page.locator('header');

    // Verify header is initially visible at top
    await expect(header).toBeVisible();

    // Get initial header position - should be at top of viewport
    const initialRect = await header.boundingBox();
    expect(initialRect?.y).toBe(0);

    // Scroll down significantly to test fixed positioning
    await page.evaluate(() => {
      // Scroll down 500px
      window.scrollTo(0, 500);
    });

    // Wait for scroll to complete
    await page.waitForTimeout(200);

    // Verify header is still visible and at same position
    await expect(header).toBeVisible();
    const scrolledRect = await header.boundingBox();
    expect(scrolledRect?.y).toBe(0); // Should still be at top of viewport

    // Scroll down more
    await page.evaluate(() => {
      window.scrollTo(0, 1000);
    });

    await page.waitForTimeout(200);

    // Header should still be at top of viewport
    const finalRect = await header.boundingBox();
    expect(finalRect?.y).toBe(0);

    // Verify header elements are still accessible
    const hamburgerButton = page.locator('[data-testid="sidebar-toggle"]');
    await expect(hamburgerButton).toBeVisible();

    // Test interaction while scrolled
    await hamburgerButton.click();

    // Sidebar should open
    const sidebar = page.locator('[role="dialog"], .sidebar, [data-testid="sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 3000 });

    // Cleanup
    await databaseHelper.cleanupTestData({
      userIds: [user.id],
      groupIds: [group.id],
      contentIds: contentItems.map(c => c.id)
    });
  });

  test('navbar should be fixed on pricing page when scrolling', async ({ page }) => {
    await page.goto('/pricing');

    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Get initial position
    const initialRect = await header.boundingBox();
    expect(initialRect?.y).toBe(0);

    // Scroll down the pricing page
    await page.evaluate(() => {
      window.scrollTo(0, 800);
    });

    await page.waitForTimeout(200);

    // Header should remain at top
    const scrolledRect = await header.boundingBox();
    expect(scrolledRect?.y).toBe(0);

    // Verify header links still work
    const homeLink = page.locator('header a[href="/"]');
    await expect(homeLink).toBeVisible();
  });

  test('navbar should be fixed on public content view when scrolling', async ({ page }) => {
    // Create public content for testing
    const user = await testData.createTestUser();
    const group = await testData.createTestGroup(user.id, 'Public Test Group');
    const content = await testData.createTestContent(
      group.id,
      user.id,
      'This is public content that should be viewable without authentication. It contains enough text to make the page scrollable so we can test the navbar behavior.'
    );

    // Make content public
    await databaseHelper.makeContentPublic(content.id);

    // Navigate to public content
    await page.goto(`/public/${content.id}`);

    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Get initial position
    const initialRect = await header.boundingBox();
    expect(initialRect?.y).toBe(0);

    // Scroll down
    await page.evaluate(() => {
      window.scrollTo(0, 400);
    });

    await page.waitForTimeout(200);

    // Header should remain fixed
    const scrolledRect = await header.boundingBox();
    expect(scrolledRect?.y).toBe(0);

    // Cleanup
    await databaseHelper.cleanupTestData({
      userIds: [user.id],
      groupIds: [group.id],
      contentIds: [content.id]
    });
  });

  test('navbar should maintain z-index above content while scrolling', async ({ page }) => {
    // Setup user and content
    const user = await testData.createTestUser();
    const group = await testData.createTestGroup(user.id, 'Z-Index Test Group');

    // Navigate and authenticate
    await page.goto('/');
    await page.evaluate((testUser) => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: testUser.id, email: testUser.email }
      }));
    }, { id: user.id, email: user.email });

    await page.reload();
    await page.waitForSelector('[data-testid="main-app"]');

    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check that header has proper z-index
    const headerZIndex = await header.evaluate((el) => {
      return window.getComputedStyle(el).zIndex;
    });

    // Should have z-index of 50 or equivalent high value
    expect(parseInt(headerZIndex)).toBeGreaterThanOrEqual(50);

    // Scroll and verify header stays above content
    await page.evaluate(() => {
      window.scrollTo(0, 300);
    });

    await page.waitForTimeout(200);

    // Header should still be visible and clickable
    const hamburger = page.locator('[data-testid="sidebar-toggle"]');
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // Cleanup
    await databaseHelper.cleanupTestData({
      userIds: [user.id],
      groupIds: [group.id]
    });
  });

  test('navbar should work on mobile viewport when scrolling', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Setup test data
    const user = await testData.createTestUser();
    const group = await testData.createTestGroup(user.id, 'Mobile Test Group');

    // Create content for scrolling
    for (let i = 0; i < 15; i++) {
      await testData.createTestContent(
        group.id,
        user.id,
        `Mobile test content ${i + 1} - This content should be scrollable on mobile devices to test the navbar behavior.`
      );
    }

    await page.goto('/');
    await page.evaluate((testUser) => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: testUser.id, email: testUser.email }
      }));
    }, { id: user.id, email: user.email });

    await page.reload();
    await page.waitForSelector('[data-testid="main-app"]');

    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Verify header is at top on mobile
    const initialRect = await header.boundingBox();
    expect(initialRect?.y).toBe(0);

    // Scroll on mobile
    await page.evaluate(() => {
      window.scrollTo(0, 600);
    });

    await page.waitForTimeout(200);

    // Header should remain fixed on mobile
    const scrolledRect = await header.boundingBox();
    expect(scrolledRect?.y).toBe(0);

    // Test mobile hamburger menu
    const hamburger = page.locator('[data-testid="sidebar-toggle"]');
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // Cleanup
    await databaseHelper.cleanupTestData({
      userIds: [user.id],
      groupIds: [group.id]
    });
  });

  test('navbar should have proper content spacing below fixed header', async ({ page }) => {
    const user = await testData.createTestUser();
    const group = await testData.createTestGroup(user.id, 'Spacing Test Group');

    await page.goto('/');
    await page.evaluate((testUser) => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: testUser.id, email: testUser.email }
      }));
    }, { id: user.id, email: user.email });

    await page.reload();
    await page.waitForSelector('[data-testid="main-app"]');

    const header = page.locator('header');
    const mainContent = page.locator('.max-w-4xl.mx-auto.w-full.bg-white.shadow-sm');

    await expect(header).toBeVisible();
    await expect(mainContent).toBeVisible();

    // Get positions
    const headerRect = await header.boundingBox();
    const contentRect = await mainContent.boundingBox();

    // Content should start below the header (accounting for padding)
    expect(contentRect?.y).toBeGreaterThan(headerRect?.height || 0);

    // Content should not be hidden behind header
    expect(contentRect?.y).toBeGreaterThanOrEqual(headerRect?.height || 0);

    // Cleanup
    await databaseHelper.cleanupTestData({
      userIds: [user.id],
      groupIds: [group.id]
    });
  });
});