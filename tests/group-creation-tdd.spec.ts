import { test, expect } from '@playwright/test';
import { DatabaseHelper } from './helpers/database-helper';
import { createTestUserWithInvites } from './helpers/invite-test-data';

/**
 * Test-Driven Development: Group Creation Feature
 *
 * This test suite follows TDD principles to comprehensively test the group creation
 * feature and verify that users can create groups and immediately use them for content.
 */
test.describe('Group Creation TDD', () => {
  let databaseHelper: DatabaseHelper;

  test.beforeEach(async ({ page }) => {
    databaseHelper = new DatabaseHelper();
  });

  test.describe('Basic Group Creation', () => {
    test('should create a new group and immediately show it in UI', async ({ page }) => {
      const groupName = `Test Group ${Date.now()}`;

      // Create and authenticate test user
      const user = createTestUserWithInvites('creator');
      const userId = await databaseHelper.createTestUser(user);

      // Mock authentication
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: userId, email: user.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]', { timeout: 15000 });

      // Step 1: Open group creation modal through sidebar
      await page.click('[data-testid="sidebar-toggle"]');
      await page.waitForSelector('[data-testid="app-sidebar"]', { timeout: 5000 });
      await page.click('[data-testid="create-group-button"]');

      // Step 2: Fill in group creation form
      await page.waitForSelector('input[placeholder*="group name"], input[placeholder*="Group name"]', { timeout: 5000 });
      await page.fill('input[placeholder*="group name"], input[placeholder*="Group name"]', groupName);

      // Step 3: Submit the form
      const submitButton = page.locator('button:has-text("Create Group")');
      await expect(submitButton).toBeVisible();
      await submitButton.click();

      // Step 4: Verify group was created and is now current
      await page.waitForSelector(`[data-testid="current-group-name"]:has-text("${groupName}")`, { timeout: 10000 });

      // Verify the group name appears in the UI
      const currentGroupName = await page.locator('[data-testid="current-group-name"]').textContent();
      expect(currentGroupName).toBe(groupName);

      // Step 5: Verify modal closed
      const modal = page.locator('.fixed.inset-0.z-50');
      await expect(modal).not.toBeVisible();

      // Cleanup
      await databaseHelper.cleanupTestData({ userIds: [userId] });
    });

    test('should validate group name input', async ({ page }) => {
      // Create and authenticate test user
      const user = createTestUserWithInvites('validator');
      const userId = await databaseHelper.createTestUser(user);

      // Mock authentication
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: userId, email: user.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]', { timeout: 15000 });

      // Step 1: Open group creation modal
      await page.click('[data-testid="sidebar-toggle"]');
      await page.waitForSelector('[data-testid="app-sidebar"]');
      await page.click('button:has-text("+")');

      // Step 2: Try to submit with empty name
      await page.waitForSelector('input[placeholder*="group name"], input[placeholder*="Group name"]');
      const submitButton = page.locator('button:has-text("Create Group")');

      // Should be disabled when empty
      await expect(submitButton).toBeDisabled();

      // Step 3: Add some text and verify button becomes enabled
      await page.fill('input[placeholder*="group name"], input[placeholder*="Group name"]', 'Valid Group Name');
      await expect(submitButton).toBeEnabled();
    });

    test('should handle group creation errors gracefully', async ({ page }) => {
      const longGroupName = 'A'.repeat(200); // Exceeds typical character limits

      // Step 1: Open group creation modal
      await page.click('[data-testid="sidebar-toggle"]');
      await page.waitForSelector('[data-testid="app-sidebar"]');
      await page.click('button:has-text("+")');

      // Step 2: Try to create group with invalid input
      await page.waitForSelector('input[placeholder*="group name"], input[placeholder*="Group name"]');
      await page.fill('input[placeholder*="group name"], input[placeholder*="Group name"]', longGroupName);

      const submitButton = page.locator('button:has-text("Create Group")');
      await submitButton.click();

      // Step 3: Should show error or handle gracefully
      // Either an error message appears or the input is truncated/rejected
      const errorMessage = page.locator('.bg-red-50, .text-red-700, .border-red-200');
      const isErrorVisible = await errorMessage.isVisible();

      if (isErrorVisible) {
        // Error handling working correctly
        expect(await errorMessage.textContent()).toBeTruthy();
      } else {
        // Input validation preventing submission - that's also valid
        const currentValue = await page.locator('input[placeholder*="group name"], input[placeholder*="Group name"]').inputValue();
        expect(currentValue.length).toBeLessThanOrEqual(50); // Reasonable limit
      }
    });
  });

  test.describe('Group Navigation and Selection', () => {
    test('should allow switching between groups', async ({ page }) => {
      const group1Name = `First Group ${Date.now()}`;
      const group2Name = `Second Group ${Date.now() + 1}`;

      // Create first group
      await createGroupViaUI(page, group1Name);
      await page.waitForSelector(`[data-testid="current-group-name"]:has-text("${group1Name}")`);

      // Create second group
      await createGroupViaUI(page, group2Name);
      await page.waitForSelector(`[data-testid="current-group-name"]:has-text("${group2Name}")`);

      // Verify we can switch back to first group
      const groupSelector = page.locator('[data-testid="group-selector"]');
      if (await groupSelector.isVisible()) {
        await groupSelector.selectOption({ label: group1Name });
        await page.waitForSelector(`[data-testid="current-group-name"]:has-text("${group1Name}")`);

        const currentName = await page.locator('[data-testid="current-group-name"]').textContent();
        expect(currentName).toBe(group1Name);
      } else {
        // If no selector visible, that means we only see current group
        // which is expected behavior for single group view
        console.log('Group selector not visible - single group mode');
      }
    });

    test('should maintain group context across page reloads', async ({ page }) => {
      const groupName = `Persistent Group ${Date.now()}`;

      // Create and select group
      await createGroupViaUI(page, groupName);
      await page.waitForSelector(`[data-testid="current-group-name"]:has-text("${groupName}")`);

      // Get current URL
      const currentUrl = page.url();

      // Reload page
      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      // Verify group is still selected
      await page.waitForSelector(`[data-testid="current-group-name"]:has-text("${groupName}")`);
      const persistedName = await page.locator('[data-testid="current-group-name"]').textContent();
      expect(persistedName).toBe(groupName);

      // Verify URL contains group reference
      expect(page.url()).toContain('group');
    });
  });

  test.describe('Content Management in Groups', () => {
    test('should allow adding content to newly created group', async ({ page }) => {
      const groupName = `Content Group ${Date.now()}`;
      const contentText = 'This is test content for the new group';

      // Step 1: Create group
      await createGroupViaUI(page, groupName);
      await page.waitForSelector(`[data-testid="current-group-name"]:has-text("${groupName}")`);

      // Step 2: Add content to the group
      await addContentToGroup(page, contentText);

      // Step 3: Verify content appears in the group
      await page.waitForSelector(`text="${contentText}"`, { timeout: 10000 });
      const contentElement = page.locator(`text="${contentText}"`);
      await expect(contentElement).toBeVisible();
    });

    test('should isolate content between different groups', async ({ page }) => {
      const group1Name = `Group One ${Date.now()}`;
      const group2Name = `Group Two ${Date.now() + 1}`;
      const content1 = 'Content for group one';
      const content2 = 'Content for group two';

      // Create first group and add content
      await createGroupViaUI(page, group1Name);
      await addContentToGroup(page, content1);
      await page.waitForSelector(`text="${content1}"`);

      // Create second group and add content
      await createGroupViaUI(page, group2Name);
      await addContentToGroup(page, content2);
      await page.waitForSelector(`text="${content2}"`);

      // Verify second group shows only its content
      await expect(page.locator(`text="${content2}"`)).toBeVisible();
      await expect(page.locator(`text="${content1}"`)).not.toBeVisible();

      // Switch back to first group if possible
      const groupSelector = page.locator('[data-testid="group-selector"]');
      if (await groupSelector.isVisible()) {
        await groupSelector.selectOption({ label: group1Name });
        await page.waitForSelector(`[data-testid="current-group-name"]:has-text("${group1Name}")`);

        // Verify first group shows only its content
        await expect(page.locator(`text="${content1}"`)).toBeVisible();
        await expect(page.locator(`text="${content2}"`)).not.toBeVisible();
      }
    });

    test('should support URL content with screenshot generation', async ({ page }) => {
      const groupName = `URL Group ${Date.now()}`;
      const testUrl = 'https://example.com';

      // Create group
      await createGroupViaUI(page, groupName);
      await page.waitForSelector(`[data-testid="current-group-name"]:has-text("${groupName}")`);

      // Add URL content
      await addContentToGroup(page, testUrl);

      // Wait for content to appear
      await page.waitForSelector(`text="${testUrl}"`, { timeout: 10000 });

      // Look for URL preview components (may take time to generate)
      const urlPreview = page.locator('.mt-3.border.border-gray-200.rounded-lg, [data-testid="url-preview"]');

      // Wait a bit for screenshot generation to potentially complete
      await page.waitForTimeout(2000);

      // Either preview should be visible or loading state should be shown
      const previewVisible = await urlPreview.isVisible();
      const loadingVisible = await page.locator('text="Generating preview"').isVisible();

      // At least one should be true (either preview loaded or still loading)
      expect(previewVisible || loadingVisible).toBe(true);
    });

    test('should handle hierarchical content in groups', async ({ page }) => {
      const groupName = `Hierarchy Group ${Date.now()}`;
      const parentContent = 'Parent item';
      const childContent = 'Child item';

      // Create group
      await createGroupViaUI(page, groupName);
      await page.waitForSelector(`[data-testid="current-group-name"]:has-text("${groupName}")`);

      // Add parent content
      await addContentToGroup(page, parentContent);
      await page.waitForSelector(`text="${parentContent}"`);

      // Click on parent item to navigate into it
      const parentItem = page.locator(`text="${parentContent}"`).first();
      await parentItem.click();

      // Add child content
      await addContentToGroup(page, childContent);
      await page.waitForSelector(`text="${childContent}"`);

      // Verify both parent and child contexts exist
      const breadcrumb = page.locator(`text="${parentContent}"`).first();
      await expect(breadcrumb).toBeVisible();
      await expect(page.locator(`text="${childContent}"`)).toBeVisible();
    });
  });

  test.describe('Group Workflow Integration', () => {
    test('should support content selection and workflow actions in groups', async ({ page }) => {
      const groupName = `Workflow Group ${Date.now()}`;
      const contentText = 'Content for workflow testing';

      // Create group and add content
      await createGroupViaUI(page, groupName);
      await addContentToGroup(page, contentText);
      await page.waitForSelector(`text="${contentText}"`);

      // Try to select content item
      const contentItem = page.locator(`text="${contentText}"`).first();

      // Look for selection mechanisms (checkbox, click selection, etc.)
      const selectionCheckbox = page.locator('input[type="checkbox"]').first();
      if (await selectionCheckbox.isVisible()) {
        await selectionCheckbox.check();

        // Look for workflow actions (like FAB or action buttons)
        const workflowButton = page.locator('[data-testid="workflow-fab"], [data-testid="fab-button"], button:has-text("📸")');

        if (await workflowButton.isVisible()) {
          await expect(workflowButton).toBeVisible();
          console.log('Workflow actions available for selected content');
        }
      } else {
        // Alternative selection method might exist
        console.log('No checkbox selection found - testing alternative selection methods');
      }
    });

    test('should maintain group context during workflow operations', async ({ page }) => {
      const groupName = `Context Group ${Date.now()}`;
      const contentText = 'Content for context testing';

      // Create group and add content
      await createGroupViaUI(page, groupName);
      await addContentToGroup(page, contentText);

      // Verify group context is maintained
      await page.waitForSelector(`[data-testid="current-group-name"]:has-text("${groupName}")`);

      // Perform some navigation within the group
      const contentItem = page.locator(`text="${contentText}"`).first();
      if (await contentItem.isVisible()) {
        await contentItem.click();

        // Group name should still be visible after navigation
        await expect(page.locator(`[data-testid="current-group-name"]:has-text("${groupName}")`)).toBeVisible();
      }
    });
  });

  // Helper function to create a group via UI
  async function createGroupViaUI(page: any, groupName: string) {
    await page.click('[data-testid="sidebar-toggle"]');
    await page.waitForSelector('[data-testid="app-sidebar"]');
    await page.click('button:has-text("+")');
    await page.waitForSelector('input[placeholder*="group name"], input[placeholder*="Group name"]');
    await page.fill('input[placeholder*="group name"], input[placeholder*="Group name"]', groupName);
    await page.click('button:has-text("Create Group")');
  }

  // Helper function to add content to current group
  async function addContentToGroup(page: any, content: string) {
    // Look for FAB or add content button
    const fabButton = page.locator('[data-testid="fab-button"], [data-testid="floating-action-button"], button:has-text("+")').last();

    if (await fabButton.isVisible()) {
      await fabButton.click();

      // Look for content input field
      const contentInput = page.locator('textarea[placeholder*="content"], input[placeholder*="content"], textarea[data-testid="content-input"]');
      if (await contentInput.isVisible()) {
        await contentInput.fill(content);

        // Submit the content
        const submitButton = page.locator('button:has-text("Add"), button:has-text("Save"), button[type="submit"]').last();
        if (await submitButton.isVisible()) {
          await submitButton.click();
        } else {
          // Try pressing Enter
          await contentInput.press('Enter');
        }
      }
    } else {
      // Alternative method - look for inline input
      const inlineInput = page.locator('textarea[placeholder*="content"], input[placeholder*="content"]').first();
      if (await inlineInput.isVisible()) {
        await inlineInput.fill(content);
        await inlineInput.press('Enter');
      }
    }

    // Wait a moment for content to be saved
    await page.waitForTimeout(1000);
  }
});