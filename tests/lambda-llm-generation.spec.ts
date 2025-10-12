import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { DatabaseHelper } from './helpers/database-helper';

test.describe('Lambda LLM Generation Workflow', () => {
  let authHelper: AuthHelper;
  let dbHelper: DatabaseHelper;
  let testUser: any;
  let testGroupId: string;
  let testContentId: string;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper();
    dbHelper = new DatabaseHelper();

    // Create test user
    const email = `lambda-llm-${Date.now()}@test.com`;
    testUser = await authHelper.createTestUser(email);

    // Create test group
    testGroupId = await dbHelper.createTestGroup({
      name: 'Lambda LLM Test Group',
      user_id: testUser.id
    });

    // Create test content
    testContentId = await dbHelper.createTestContent({
      type: 'text',
      data: 'The quick brown fox jumps over the lazy dog.',
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

  test('should generate content with LLM via Lambda', async ({ page }) => {
    console.log('🧪 Testing Lambda LLM Generation Workflow');

    // Select content
    const contentItem = page.locator(`[data-content-id="${testContentId}"]`).first();
    await expect(contentItem).toBeVisible({ timeout: 10000 });
    await contentItem.click();
    console.log('✓ Content selected');

    // Open LLM generation dialog
    const llmButton = page.locator('button:has-text("Generate with AI")').or(
      page.locator('[data-testid="llm-generate-button"]')
    ).first();

    if (!await llmButton.isVisible()) {
      const moreButton = page.locator('button:has-text("More")').first();
      if (await moreButton.isVisible()) {
        await moreButton.click();
        await page.waitForTimeout(500);
      }
    }

    await expect(llmButton).toBeVisible({ timeout: 5000 });
    await llmButton.click();
    console.log('✓ LLM dialog opened');

    // Fill in prompt
    const promptInput = page.locator('textarea[placeholder*="prompt"]').or(
      page.locator('[data-testid="llm-prompt-input"]')
    ).first();

    await expect(promptInput).toBeVisible({ timeout: 5000 });
    await promptInput.fill('Summarize this text in one sentence.');
    console.log('✓ Prompt entered');

    // Submit
    const generateButton = page.locator('button:has-text("Generate")').or(
      page.locator('[data-testid="llm-submit-button"]')
    ).first();

    await generateButton.click();
    console.log('✓ Generation started');

    // Wait for generation to complete (can take up to 30 seconds)
    const successIndicator = page.locator('text=/Generated|Complete|Success/i').or(
      page.locator('[data-testid="llm-success"]')
    );

    await expect(successIndicator).toBeVisible({ timeout: 40000 });
    console.log('✓ Generation completed');

    // Verify generated content exists in database
    // The prompt should be created as a content item
    const promptContent = await dbHelper.getContentByType(testGroupId, 'prompt');
    expect(promptContent.length).toBeGreaterThan(0);

    const latestPrompt = promptContent[promptContent.length - 1];
    expect(latestPrompt.data).toContain('Summarize');

    // Verify generated content is child of prompt
    const generatedContent = await dbHelper.getContentByParentId(latestPrompt.id);
    expect(generatedContent.length).toBeGreaterThan(0);
    expect(generatedContent[0].metadata?.generated_by_llm).toBe(true);

    console.log('✅ Lambda LLM generation workflow validated');
  });

  test('should handle LLM generation errors gracefully', async ({ page }) => {
    console.log('🧪 Testing Lambda LLM error handling');

    // Select content
    const contentItem = page.locator(`[data-content-id="${testContentId}"]`).first();
    await contentItem.click();

    // Open LLM dialog
    const llmButton = page.locator('button:has-text("Generate with AI")').first();
    if (!await llmButton.isVisible()) {
      const moreButton = page.locator('button:has-text("More")').first();
      if (await moreButton.isVisible()) {
        await moreButton.click();
      }
    }
    await llmButton.click();

    // Try to generate with empty prompt
    const generateButton = page.locator('button:has-text("Generate")').first();

    // Button should be disabled or show validation error
    const isDisabled = await generateButton.isDisabled();
    expect(isDisabled).toBe(true);

    console.log('✅ Lambda LLM validation working');
  });

  test('should generate code content with LLM', async ({ page }) => {
    console.log('🧪 Testing Lambda LLM code generation');

    // Create coding-related content
    const codeContentId = await dbHelper.createTestContent({
      type: 'text',
      data: 'Create a function that adds two numbers',
      group_id: testGroupId,
      user_id: testUser.id,
      parent_content_id: null
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select content and generate
    const contentItem = page.locator(`[data-content-id="${codeContentId}"]`).first();
    await contentItem.click();

    const llmButton = page.locator('button:has-text("Generate with AI")').first();
    if (!await llmButton.isVisible()) {
      const moreButton = page.locator('button:has-text("More")').first();
      if (await moreButton.isVisible()) {
        await moreButton.click();
      }
    }
    await llmButton.click();

    // Enter code generation prompt
    const promptInput = page.locator('textarea[placeholder*="prompt"]').first();
    await promptInput.fill('Write a JavaScript function for this requirement');

    const generateButton = page.locator('button:has-text("Generate")').first();
    await generateButton.click();

    // Wait for completion
    await page.waitForTimeout(15000);

    // Verify code content was created
    const generatedContent = await dbHelper.getContentByType(testGroupId, 'js');
    expect(generatedContent.length).toBeGreaterThan(0);

    // Cleanup
    await dbHelper.deleteTestContent(codeContentId);

    console.log('✅ Lambda LLM code generation validated');
  });
});
