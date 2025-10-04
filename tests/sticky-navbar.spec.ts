import { test, expect } from '@playwright/test';

test.describe('Sticky Navbar Full-Width Functionality', () => {

  test('navbar should span full width and remain fixed on pricing page', async ({ page }) => {
    await page.goto('/pricing');

    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Get initial position and verify full width
    const initialRect = await header.boundingBox();
    expect(initialRect?.y).toBe(0);

    const viewportSize = page.viewportSize();
    expect(initialRect?.width).toBe(viewportSize?.width);
    expect(initialRect?.x).toBe(0);

    // Scroll down the pricing page
    await page.evaluate(() => {
      window.scrollTo(0, 800);
    });

    await page.waitForTimeout(200);

    // Header should remain at top and full width
    const scrolledRect = await header.boundingBox();
    expect(scrolledRect?.y).toBe(0);
    expect(scrolledRect?.width).toBe(viewportSize?.width);
    expect(scrolledRect?.x).toBe(0);

    // Verify header links still work
    const homeLink = page.locator('header a[href="/"]');
    await expect(homeLink).toBeVisible();
  });

  test('navbar should have proper z-index on pricing page', async ({ page }) => {
    await page.goto('/pricing');

    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check that header has proper z-index and spans full width
    const headerZIndex = await header.evaluate((el) => {
      return window.getComputedStyle(el).zIndex;
    });

    // Should have z-index of 50 or equivalent high value
    expect(parseInt(headerZIndex)).toBeGreaterThanOrEqual(50);

    // Verify full width
    const headerRect = await header.boundingBox();
    const viewportSize = page.viewportSize();
    expect(headerRect?.width).toBe(viewportSize?.width);
    expect(headerRect?.x).toBe(0);
  });

  test('navbar should work on mobile viewport with full width', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/pricing');

    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Verify header is at top and spans full mobile width
    const initialRect = await header.boundingBox();
    expect(initialRect?.y).toBe(0);
    expect(initialRect?.width).toBe(375); // Mobile viewport width
    expect(initialRect?.x).toBe(0);

    // Scroll on mobile
    await page.evaluate(() => {
      window.scrollTo(0, 600);
    });

    await page.waitForTimeout(200);

    // Header should remain fixed and full width on mobile
    const scrolledRect = await header.boundingBox();
    expect(scrolledRect?.y).toBe(0);
    expect(scrolledRect?.width).toBe(375);
    expect(scrolledRect?.x).toBe(0);
  });

  test('navbar should span full width on different viewport sizes', async ({ page }) => {
    const viewportSizes = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1024, height: 768 },  // Tablet landscape
      { width: 768, height: 1024 },  // Tablet portrait
      { width: 375, height: 667 },   // Mobile
    ];

    for (const viewport of viewportSizes) {
      await page.setViewportSize(viewport);
      await page.goto('/pricing');

      const header = page.locator('header');
      await expect(header).toBeVisible();

      // Verify header spans full width for this viewport
      const headerRect = await header.boundingBox();
      expect(headerRect?.width).toBe(viewport.width);
      expect(headerRect?.x).toBe(0);
      expect(headerRect?.y).toBe(0);
    }
  });
});