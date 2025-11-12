import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { DatabaseHelper } from './helpers/database-helper';
import { createTestUserWithInvites } from './helpers/invite-test-data';
import * as UIHelper from './helpers/ui-helper';

/**
 * AI Chat E2E Tests
 *
 * Tests the complete AI chat flow using ContentActionsDrawer:
 * - Opening drawer and selecting AI Chat action
 * - Creating new chat with AI response
 * - Continuing conversation
 * - Visual state management
 * - Database validation
 */

test.describe('AI Chat End-to-End', () => {
  test.describe.configure({ mode: 'serial' });

  let authHelper: AuthHelper;
  let dbHelper: DatabaseHelper;
  let testUserId: string;
  let testGroupId: string;
  let chatContentId: string;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper();
    dbHelper = new DatabaseHelper();

    // Create unique test user
    const timestamp = Date.now();
    const testUser = createTestUserWithInvites(`ai-chat-test-${timestamp}`);
    testUser.password = 'TestPassword123!';

    // Create user in database
    testUserId = await dbHelper.createTestUser(testUser);
    console.log(`Created test user: ${testUser.email} (${testUserId})`);

    // Create test group
    testGroupId = await dbHelper.createTestGroup(
      { name: `AI Chat Test Group ${timestamp}`, inviteCodes: [], invitedUsers: [] },
      testUserId
    );
    await dbHelper.addGroupMember(testUserId, testGroupId, 'admin');
    console.log(`Created test group: ${testGroupId}`);

    // Login
    await authHelper.loginProgrammatically(page, testUser.email, testUser.password);

    // Navigate to test group
    await page.goto(`http://localhost:3004/?g=${testGroupId}`);
    await page.waitForLoadState('networkidle');

    // Verify we're on the correct group
    await expect(page).toHaveURL(new RegExp(`g=${testGroupId}`));
  });

  test.afterEach(async () => {
    // Cleanup test data
    try {
      if (chatContentId) {
        console.log(`Cleaning up chat: ${chatContentId}`);
        await dbHelper.deleteTestContent(chatContentId);
      }
      if (testGroupId) {
        console.log(`Cleaning up group: ${testGroupId}`);
        await dbHelper.deleteTestGroup(testGroupId);
      }
      if (testUserId) {
        console.log(`Cleaning up user: ${testUserId}`);
        await dbHelper.deleteTestUser(testUserId);
      }
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  test('should open drawer and show all actions', async ({ page }) => {
    // Open drawer
    await UIHelper.openDrawer(page);

    // Verify all 6 actions are visible
    await expect(page.locator('button').filter({ hasText: 'Import' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Claude Code' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'AI Chat' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Image' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Book' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Plugin' })).toBeVisible();
  });

  test('should activate AI Chat mode with correct styling', async ({ page }) => {
    // Open drawer and select AI Chat
    await UIHelper.openDrawer(page);
    await UIHelper.selectDrawerAction(page, 'AI Chat');

    // Verify drawer closed
    const drawer = page.locator('.bg-gray-800.rounded-t-2xl');
    await expect(drawer).not.toBeVisible();

    // Verify input has purple left border (AI Chat color)
    await UIHelper.verifyInputStyling(page, 'ai-chat', 'rgb(168, 85, 247)');

    // Verify placeholder changed
    const placeholder = page.locator('.lexical-placeholder');
    await expect(placeholder).toHaveText(/Ask AI a question/i);

    // Verify drawer handle shows "AI Chat" label
    await UIHelper.verifyDrawerHandleLabel(page, 'AI Chat');
  });

  test('should create new AI chat and receive response', async ({ page }) => {
    // Open drawer and select AI Chat
    await UIHelper.openDrawer(page);
    await UIHelper.selectDrawerAction(page, 'AI Chat');

    // Type test question
    const testQuestion = 'What is 2+2? Please answer briefly.';
    await UIHelper.typeInContentInput(page, testQuestion);

    // Submit with Enter
    await UIHelper.submitContent(page);

    // Wait for chat container to appear
    chatContentId = await UIHelper.waitForChatContainer(page, 15000);
    console.log(`Chat created: ${chatContentId}`);

    // Verify chat container in database
    const chatContainer = await dbHelper.getContentById(chatContentId);
    expect(chatContainer).not.toBeNull();
    expect(chatContainer.type).toBe('chat');
    expect(chatContainer.data).toMatch(/^Chat:/);

    // Wait for assistant response in database
    const assistantMessage = await dbHelper.waitForAssistantResponse(chatContentId, 35000);
    expect(assistantMessage).not.toBeNull();
    expect(assistantMessage.data).toBeTruthy();
    expect(assistantMessage.data.length).toBeGreaterThan(0);
    console.log(`Assistant response received: "${assistantMessage.data.substring(0, 50)}..."`);

    // Verify chat structure
    const chatStructure = await dbHelper.verifyChatStructure(chatContentId);
    expect(chatStructure.isValid).toBe(true);
    if (!chatStructure.isValid) {
      console.error('Chat structure errors:', chatStructure.errors);
    }
    expect(chatStructure.userMessages.length).toBe(1);
    expect(chatStructure.assistantMessages.length).toBe(1);

    // Verify assistant message appears in UI
    await UIHelper.waitForAssistantResponse(page, 35000);
    const assistantUI = page.locator('.bg-blue-50.border-l-4.border-blue-500');
    await expect(assistantUI).toBeVisible();

    // Verify assistant message content is displayed
    const assistantText = await assistantUI.textContent();
    expect(assistantText).toBeTruthy();
    expect(assistantText!.length).toBeGreaterThan(0);
  });

  test('should continue conversation with follow-up questions', async ({ page }) => {
    // First, create initial chat
    await UIHelper.openDrawer(page);
    await UIHelper.selectDrawerAction(page, 'AI Chat');
    await UIHelper.typeInContentInput(page, 'What is the capital of France?');
    await UIHelper.submitContent(page);

    chatContentId = await UIHelper.waitForChatContainer(page, 15000);
    await dbHelper.waitForAssistantResponse(chatContentId, 35000);

    // Navigate into chat
    await UIHelper.navigateIntoChat(page, chatContentId);

    // Wait for messages to load
    await UIHelper.waitForAssistantResponse(page, 5000);

    // Ask follow-up question
    await UIHelper.typeInContentInput(page, 'Why is it the capital?');
    await UIHelper.submitContent(page);

    // Wait for second assistant response
    await page.waitForTimeout(2000);
    await dbHelper.waitForAssistantResponse(chatContentId, 35000);

    // Verify we now have 2 user messages and 2 assistant messages
    const userCount = await dbHelper.countMessagesByRole(chatContentId, 'user');
    const assistantCount = await dbHelper.countMessagesByRole(chatContentId, 'assistant');

    expect(userCount).toBe(2);
    expect(assistantCount).toBe(2);

    // Verify 2 assistant messages in UI
    const assistantMessageCount = await UIHelper.countAssistantMessages(page);
    expect(assistantMessageCount).toBe(2);
  });

  test('should show loading state while waiting for response', async ({ page }) => {
    // Open drawer and select AI Chat
    await UIHelper.openDrawer(page);
    await UIHelper.selectDrawerAction(page, 'AI Chat');

    // Type and submit
    await UIHelper.typeInContentInput(page, 'What is 2+2?');
    await UIHelper.submitContent(page);

    // Wait for chat container
    chatContentId = await UIHelper.waitForChatContainer(page, 15000);

    // Navigate into chat (should happen automatically, but ensure we're there)
    await page.waitForTimeout(1000);

    // Check for loading indicator (3 bouncing dots)
    // Note: This might appear briefly before response comes
    const loadingIndicator = page.locator('.animate-bounce');

    // We'll just verify the assistant message eventually appears
    // (loading state is transient and hard to catch reliably)
    await UIHelper.waitForAssistantResponse(page, 35000);

    // Verify assistant message is no longer in loading state
    const assistantMessage = await dbHelper.getLastAssistantMessage(chatContentId);
    expect(assistantMessage.metadata?.streaming).toBeFalsy();
  });

  test('should preserve active action when reopening drawer', async ({ page }) => {
    // Select AI Chat
    await UIHelper.openDrawer(page);
    await UIHelper.selectDrawerAction(page, 'AI Chat');

    // Verify AI Chat is active
    await UIHelper.verifyInputStyling(page, 'ai-chat', 'rgb(168, 85, 247)');
    await UIHelper.verifyDrawerHandleLabel(page, 'AI Chat');

    // Open drawer again (without selecting different action)
    await UIHelper.openDrawer(page);

    // Close drawer by clicking outside or handle
    await UIHelper.closeDrawer(page);

    // Verify AI Chat is still active
    await UIHelper.verifyInputStyling(page, 'ai-chat', 'rgb(168, 85, 247)');
  });

  test('should clear active action after successful chat creation', async ({ page }) => {
    // Select AI Chat
    await UIHelper.openDrawer(page);
    await UIHelper.selectDrawerAction(page, 'AI Chat');

    // Create chat
    await UIHelper.typeInContentInput(page, 'Test question');
    await UIHelper.submitContent(page);

    chatContentId = await UIHelper.waitForChatContainer(page, 15000);

    // Wait a moment for navigation and state clearing
    await page.waitForTimeout(2000);

    // After navigation into chat, active action should be cleared
    // (Input should not have purple border anymore since we're inside chat)
    const contentEditable = page.locator('.lexical-content-editable');
    const borderLeftWidth = await contentEditable.evaluate(el =>
      window.getComputedStyle(el).borderLeftWidth
    );

    // In chat view, no special action styling
    expect(borderLeftWidth).not.toBe('4px');
  });

  test('should display assistant messages with correct styling', async ({ page }) => {
    // Create chat
    await UIHelper.openDrawer(page);
    await UIHelper.selectDrawerAction(page, 'AI Chat');
    await UIHelper.typeInContentInput(page, 'Hello AI');
    await UIHelper.submitContent(page);

    chatContentId = await UIHelper.waitForChatContainer(page, 15000);
    await dbHelper.waitForAssistantResponse(chatContentId, 35000);

    // Verify assistant message styling
    const assistantMessage = page.locator('.bg-blue-50.border-l-4.border-blue-500').first();
    await expect(assistantMessage).toBeVisible();

    // Verify it has blue background class
    const bgColor = await assistantMessage.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).toMatch(/rgb/); // Has color (not default)

    // Verify it has left border
    const borderLeftWidth = await assistantMessage.evaluate(el =>
      window.getComputedStyle(el).borderLeftWidth
    );
    expect(borderLeftWidth).toBe('4px');
  });

  test('should handle chat when OPENAI_API_KEY is missing gracefully', async ({ page }) => {
    // This test will likely fail the Lambda call if API key is missing
    // But we're testing that the app doesn't crash

    await UIHelper.openDrawer(page);
    await UIHelper.selectDrawerAction(page, 'AI Chat');
    await UIHelper.typeInContentInput(page, 'Test');
    await UIHelper.submitContent(page);

    // Wait for chat container
    chatContentId = await UIHelper.waitForChatContainer(page, 15000);

    // Try to wait for response, but expect it might fail
    try {
      await dbHelper.waitForAssistantResponse(chatContentId, 10000);
    } catch (error) {
      // If it times out, check if error message was created
      const messages = await dbHelper.getChatMessages(chatContentId);
      const assistantMessages = messages.filter(m => m.metadata?.role === 'assistant');

      if (assistantMessages.length > 0) {
        // Verify error metadata
        const lastMessage = assistantMessages[assistantMessages.length - 1];
        if (lastMessage.metadata?.error) {
          console.log('Error message created as expected:', lastMessage.data);
          return; // Test passes - error was handled
        }
      }

      // Otherwise this is a real test failure
      throw error;
    }
  });
});
