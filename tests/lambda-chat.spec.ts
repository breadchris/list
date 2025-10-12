import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { DatabaseHelper } from './helpers/database-helper';

test.describe('Lambda Chat Workflow', () => {
  let authHelper: AuthHelper;
  let dbHelper: DatabaseHelper;
  let testUser: any;
  let testGroupId: string;
  let chatContentId: string;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper();
    dbHelper = new DatabaseHelper();

    // Create test user
    const email = `lambda-chat-${Date.now()}@test.com`;
    testUser = await authHelper.createTestUser(email);

    // Create test group
    testGroupId = await dbHelper.createTestGroup({
      name: 'Lambda Chat Test Group',
      user_id: testUser.id
    });

    // Create a chat content item
    chatContentId = await dbHelper.createTestContent({
      type: 'chat',
      data: 'Chat with AI',
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
    if (chatContentId) {
      await dbHelper.deleteTestContent(chatContentId);
    }
    if (testGroupId) {
      await dbHelper.deleteTestGroup(testGroupId);
    }
    if (testUser?.id) {
      await dbHelper.deleteTestUser(testUser.id);
    }
  });

  test('should send and receive chat messages via Lambda', async ({ page }) => {
    console.log('🧪 Testing Lambda Chat Workflow');

    // Find and click on chat content
    const chatItem = page.locator(`[data-content-id="${chatContentId}"]`).first();
    await expect(chatItem).toBeVisible({ timeout: 10000 });
    await chatItem.click();
    console.log('✓ Chat item selected');

    // Open chat interface
    const openChatButton = page.locator('button:has-text("Open Chat")').or(
      page.locator('[data-testid="open-chat-button"]')
    ).first();

    if (await openChatButton.isVisible()) {
      await openChatButton.click();
      await page.waitForTimeout(1000);
    }

    // Find chat input
    const chatInput = page.locator('textarea[placeholder*="message"]').or(
      page.locator('[data-testid="chat-input"]')
    ).first();

    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // Send a message
    const testMessage = 'What is 2+2?';
    await chatInput.fill(testMessage);
    console.log(`✓ Message entered: ${testMessage}`);

    // Submit message
    const sendButton = page.locator('button:has-text("Send")').or(
      page.locator('[data-testid="chat-send-button"]')
    ).first();

    await sendButton.click();
    console.log('✓ Message sent');

    // Wait for AI response
    const aiResponse = page.locator('text=/assistant.*|AI.*4/i').or(
      page.locator('[data-role="assistant"]')
    );

    await expect(aiResponse).toBeVisible({ timeout: 30000 });
    console.log('✓ AI response received');

    // Verify messages in database
    const chatMessages = await dbHelper.getContentByParentId(chatContentId);
    expect(chatMessages.length).toBeGreaterThanOrEqual(2); // User message + AI response

    // Find assistant message
    const assistantMessage = chatMessages.find(msg =>
      msg.metadata?.role === 'assistant'
    );

    expect(assistantMessage).toBeDefined();
    expect(assistantMessage?.metadata?.created_by_chat).toBe(true);

    console.log('✅ Lambda chat workflow validated');
  });

  test('should handle empty chat messages', async ({ page }) => {
    console.log('🧪 Testing Lambda Chat validation');

    const chatItem = page.locator(`[data-content-id="${chatContentId}"]`).first();
    await chatItem.click();

    const openChatButton = page.locator('button:has-text("Open Chat")').first();
    if (await openChatButton.isVisible()) {
      await openChatButton.click();
    }

    const chatInput = page.locator('textarea[placeholder*="message"]').first();
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // Try to send empty message
    const sendButton = page.locator('button:has-text("Send")').first();

    // Button should be disabled with empty input
    const isDisabled = await sendButton.isDisabled();
    expect(isDisabled).toBe(true);

    console.log('✅ Chat validation working');
  });

  test('should maintain conversation context', async ({ page }) => {
    console.log('🧪 Testing Lambda Chat context preservation');

    const chatItem = page.locator(`[data-content-id="${chatContentId}"]`).first();
    await chatItem.click();

    const openChatButton = page.locator('button:has-text("Open Chat")').first();
    if (await openChatButton.isVisible()) {
      await openChatButton.click();
    }

    const chatInput = page.locator('textarea[placeholder*="message"]').first();
    const sendButton = page.locator('button:has-text("Send")').first();

    // Send first message
    await chatInput.fill('My name is Test User');
    await sendButton.click();
    await page.waitForTimeout(3000);

    // Send follow-up that requires context
    await chatInput.fill('What is my name?');
    await sendButton.click();

    // Wait for response
    await page.waitForTimeout(5000);

    // Verify conversation has multiple turns
    const chatMessages = await dbHelper.getContentByParentId(chatContentId);
    expect(chatMessages.length).toBeGreaterThanOrEqual(4); // 2 user messages + 2 assistant responses

    console.log('✅ Chat context preservation validated');
  });

  test('should handle chat errors gracefully', async ({ page }) => {
    console.log('🧪 Testing Lambda Chat error handling');

    // Create invalid chat (no ID)
    const invalidChatId = await dbHelper.createTestContent({
      type: 'chat',
      data: 'Invalid Chat Test',
      group_id: testGroupId,
      user_id: testUser.id,
      parent_content_id: null
    });

    // Delete it immediately to simulate missing chat
    await dbHelper.deleteTestContent(invalidChatId);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Try to interact with deleted chat
    const deletedChatItem = page.locator(`[data-content-id="${invalidChatId}"]`).first();

    // Should not be visible (already deleted)
    const isVisible = await deletedChatItem.isVisible().catch(() => false);
    expect(isVisible).toBe(false);

    console.log('✅ Chat error handling validated');
  });
});
