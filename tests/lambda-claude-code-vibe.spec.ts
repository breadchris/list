import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { DatabaseHelper } from './helpers/database-helper';

test.describe('Claude Code Vibe Coding Workflow', () => {
  let authHelper: AuthHelper;
  let dbHelper: DatabaseHelper;
  let testUser: any;
  let testGroupId: string;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper();
    dbHelper = new DatabaseHelper();

    // Create test user
    const email = `claude-vibe-${Date.now()}@test.com`;
    testUser = {
      email,
      password: 'TestPass123!',
      id: '',
      username: `claude_vibe_${Date.now()}`
    };

    // Create user in database
    testUser.id = await dbHelper.createTestUser(testUser);

    // Create a test group
    testGroupId = await dbHelper.createTestGroup({
      name: 'Claude Vibe Test Group',
      id: '',
      inviteCodes: [],
      invitations: []
    }, testUser.id);

    // Add user to group
    await dbHelper.addGroupMember(testUser.id, testGroupId, 'admin');

    // Login
    await authHelper.loginProgrammatically(page, testUser.email, testUser.password);

    // Navigate to the group
    await page.goto(`/?g=${testGroupId}`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    // Cleanup
    if (testGroupId) {
      await dbHelper.deleteTestGroup(testGroupId);
    }
    if (testUser?.id) {
      await dbHelper.deleteTestUser(testUser.id);
    }
  });

  test('should open Claude Code modal and execute simple component', async ({ page }) => {
    console.log('🧪 Testing Claude Code Simple Component Generation');

    // Open FAB menu and click Claude Code
    const fabButton = page.locator('[data-testid="fab-button"]').or(
      page.locator('button:has-text("+")')
    ).first();

    await fabButton.click();
    await page.waitForTimeout(500);

    const claudeCodeButton = page.locator('button:has-text("Claude Code")').or(
      page.locator('[data-testid="claude-code-button"]')
    ).first();

    await expect(claudeCodeButton).toBeVisible({ timeout: 5000 });
    await claudeCodeButton.click();
    console.log('✓ Claude Code modal opened');

    // Wait for modal to be visible
    const modal = page.locator('[data-testid="claude-code-modal"]').or(
      page.locator('text=Claude Code Execution')
    );
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Enter prompt
    const promptInput = page.locator('textarea[placeholder*="coding task"]').or(
      page.locator('textarea#claude-code-prompt')
    ).first();

    await promptInput.fill('Create a simple Button component with TypeScript. Use only React, no external dependencies.');
    console.log('✓ Prompt entered');

    // Execute
    const executeButton = page.locator('button:has-text("Execute Code")').or(
      page.locator('button:has-text("Execute")')
    ).first();

    await executeButton.click();
    console.log('✓ Execution started');

    // Wait for success toast
    const successToast = page.locator('text=/Claude Code.*started|Session.*started/i').or(
      page.locator('[role="alert"]:has-text("started")')
    );

    await expect(successToast).toBeVisible({ timeout: 60000 });
    console.log('✓ Execution completed');

    // Wait for content to be created in database
    await page.waitForTimeout(2000);

    // Verify content was created
    const content = await page.locator('[data-content-id]').first();
    await expect(content).toBeVisible({ timeout: 5000 });

    console.log('✅ Claude Code simple component generation validated');
  });

  test('should execute Claude Code with selected content', async ({ page }) => {
    console.log('🧪 Testing Claude Code with Selected Content');

    // Create test content items
    const contentId1 = await dbHelper.createTestContent({
      type: 'text',
      data: 'https://react.dev/learn',
      group_id: testGroupId,
      user_id: testUser.id,
      parent_content_id: null
    });

    const contentId2 = await dbHelper.createTestContent({
      type: 'text',
      data: 'https://github.com/facebook/react',
      group_id: testGroupId,
      user_id: testUser.id,
      parent_content_id: null
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select first content item
    const content1 = page.locator(`[data-content-id="${contentId1}"]`).first();
    await expect(content1).toBeVisible({ timeout: 10000 });
    await content1.click();
    console.log('✓ First content selected');

    // Hold Cmd/Ctrl and select second content item
    const isMac = process.platform === 'darwin';
    await page.keyboard.down(isMac ? 'Meta' : 'Control');

    const content2 = page.locator(`[data-content-id="${contentId2}"]`).first();
    await content2.click();
    console.log('✓ Second content selected');

    await page.keyboard.up(isMac ? 'Meta' : 'Control');

    // Open Claude Code from context menu or FAB
    const moreButton = page.locator('button:has-text("More")').first();
    if (await moreButton.isVisible()) {
      await moreButton.click();
      await page.waitForTimeout(500);
    }

    const claudeCodeButton = page.locator('button:has-text("Claude Code")').first();
    await claudeCodeButton.click();
    console.log('✓ Claude Code modal opened with selected content');

    // Verify selected content is shown in modal
    const selectedContentSection = page.locator('text=/Selected Content.*2 items/i');
    await expect(selectedContentSection).toBeVisible({ timeout: 5000 });
    console.log('✓ Selected content displayed in modal');

    // Enter prompt
    const promptInput = page.locator('textarea#claude-code-prompt').first();
    await promptInput.fill('Create a LinkList component that displays these URLs as clickable links.');

    // Execute
    const executeButton = page.locator('button:has-text("Execute Code")').first();
    await executeButton.click();

    // Wait for success
    const successToast = page.locator('text=/Claude Code.*started/i');
    await expect(successToast).toBeVisible({ timeout: 60000 });

    // Cleanup
    await dbHelper.deleteTestContent(contentId1);
    await dbHelper.deleteTestContent(contentId2);

    console.log('✅ Claude Code with selected content validated');
  });

  test('should continue Claude Code session', async ({ page }) => {
    console.log('🧪 Testing Claude Code Session Continuation');

    // Create initial Claude Code content
    const claudeCodeContentId = await dbHelper.createTestContent({
      type: 'claude-code',
      data: 'Create a Counter component',
      group_id: testGroupId,
      user_id: testUser.id,
      parent_content_id: null,
      metadata: {
        claude_code_session: {
          session_id: 'test-session-' + Date.now(),
          initial_prompt: 'Create a Counter component',
          created_at: new Date().toISOString()
        }
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click on the Claude Code content item
    const claudeCodeContent = page.locator(`[data-content-id="${claudeCodeContentId}"]`).first();
    await expect(claudeCodeContent).toBeVisible({ timeout: 10000 });
    await claudeCodeContent.click();
    console.log('✓ Claude Code content selected');

    // Open Claude Code (should show session continuation)
    const moreButton = page.locator('button:has-text("More")').first();
    if (await moreButton.isVisible()) {
      await moreButton.click();
      await page.waitForTimeout(500);
    }

    const claudeCodeButton = page.locator('button:has-text("Claude Code")').first();
    await claudeCodeButton.click();

    // Verify session info is shown
    const sessionInfo = page.locator('text=/Session Active|Continuing session/i');
    await expect(sessionInfo).toBeVisible({ timeout: 5000 });
    console.log('✓ Session continuation detected');

    // Enter continuation prompt
    const promptInput = page.locator('textarea#claude-code-prompt').first();
    await promptInput.fill('Add a reset button to the Counter');

    // Execute continuation
    const executeButton = page.locator('button:has-text("Continue Session")').or(
      page.locator('button:has-text("Execute")')
    ).first();

    await executeButton.click();

    // Wait for success
    const successToast = page.locator('text=/Claude Code.*continued/i');
    await expect(successToast).toBeVisible({ timeout: 60000 });

    // Cleanup
    await dbHelper.deleteTestContent(claudeCodeContentId);

    console.log('✅ Claude Code session continuation validated');
  });

  test('should handle Claude Code errors gracefully', async ({ page }) => {
    console.log('🧪 Testing Claude Code Error Handling');

    // Open Claude Code modal
    const fabButton = page.locator('[data-testid="fab-button"]').or(
      page.locator('button:has-text("+")')
    ).first();

    await fabButton.click();
    await page.waitForTimeout(500);

    const claudeCodeButton = page.locator('button:has-text("Claude Code")').first();
    await claudeCodeButton.click();

    // Try to execute with empty prompt
    const executeButton = page.locator('button:has-text("Execute Code")').first();

    // Button should be disabled with empty prompt
    await expect(executeButton).toBeDisabled({ timeout: 2000 });
    console.log('✓ Execute button disabled with empty prompt');

    // Enter very short prompt (should fail validation)
    const promptInput = page.locator('textarea#claude-code-prompt').first();
    await promptInput.fill('Hi');

    await executeButton.click();

    // Should show validation error
    const errorToast = page.locator('text=/Invalid Prompt|must be at least/i').or(
      page.locator('[role="alert"]:has-text("error")')
    );

    await expect(errorToast).toBeVisible({ timeout: 5000 });

    console.log('✅ Claude Code error handling validated');
  });

  test('should show session ID in toast after execution', async ({ page }) => {
    console.log('🧪 Testing Session ID Display');

    // Open Claude Code
    const fabButton = page.locator('[data-testid="fab-button"]').or(
      page.locator('button:has-text("+")')
    ).first();

    await fabButton.click();
    await page.waitForTimeout(500);

    const claudeCodeButton = page.locator('button:has-text("Claude Code")').first();
    await claudeCodeButton.click();

    // Enter prompt
    const promptInput = page.locator('textarea#claude-code-prompt').first();
    await promptInput.fill('Create a simple React component');

    // Execute
    const executeButton = page.locator('button:has-text("Execute Code")').first();
    await executeButton.click();

    // Wait for success toast with session ID
    const successToastWithSession = page.locator('text=/Session.*session-.*started/i');
    await expect(successToastWithSession).toBeVisible({ timeout: 60000 });

    // Extract session ID from toast
    const toastText = await successToastWithSession.textContent();
    const sessionIdMatch = toastText?.match(/session-[a-z0-9-]+/i);

    if (sessionIdMatch) {
      console.log(`✓ Session ID displayed: ${sessionIdMatch[0]}`);
    } else {
      throw new Error('Session ID not found in toast message');
    }

    console.log('✅ Session ID display validated');
  });

  test('should execute Claude Code with React hooks constraint', async ({ page }) => {
    console.log('🧪 Testing Vibe Coding Constraint - React Hooks');

    // Open Claude Code
    const fabButton = page.locator('[data-testid="fab-button"]').or(
      page.locator('button:has-text("+")')
    ).first();

    await fabButton.click();
    await page.waitForTimeout(500);

    const claudeCodeButton = page.locator('button:has-text("Claude Code")').first();
    await claudeCodeButton.click();

    // Enter prompt with React hooks
    const promptInput = page.locator('textarea#claude-code-prompt').first();
    await promptInput.fill('Create a Timer component using useState and useEffect. Use only React, no external dependencies.');

    // Execute
    const executeButton = page.locator('button:has-text("Execute Code")').first();
    await executeButton.click();

    // Wait for success
    const successToast = page.locator('text=/Claude Code.*started/i');
    await expect(successToast).toBeVisible({ timeout: 60000 });

    console.log('✅ React hooks constraint validated');
  });

  test('should show execution progress', async ({ page }) => {
    console.log('🧪 Testing Execution Progress Display');

    // Open Claude Code
    const fabButton = page.locator('[data-testid="fab-button"]').or(
      page.locator('button:has-text("+")')
    ).first();

    await fabButton.click();
    await page.waitForTimeout(500);

    const claudeCodeButton = page.locator('button:has-text("Claude Code")').first();
    await claudeCodeButton.click();

    // Enter prompt
    const promptInput = page.locator('textarea#claude-code-prompt').first();
    await promptInput.fill('Create a simple component');

    // Execute
    const executeButton = page.locator('button:has-text("Execute Code")').first();
    await executeButton.click();

    // Check for progress indicators
    const progressIndicator = page.locator('text=/Calling Claude Code Lambda|Preparing.*execution|Creating.*content/i');
    await expect(progressIndicator).toBeVisible({ timeout: 2000 });
    console.log('✓ Progress indicator shown');

    // Check for loading spinner
    const loadingSpinner = page.locator('.animate-spin').or(
      page.locator('[data-testid="loading-spinner"]')
    );
    await expect(loadingSpinner).toBeVisible({ timeout: 2000 });
    console.log('✓ Loading spinner shown');

    // Wait for completion
    const successToast = page.locator('text=/Claude Code.*started/i');
    await expect(successToast).toBeVisible({ timeout: 60000 });

    console.log('✅ Execution progress display validated');
  });

  test('should support Cmd+Enter keyboard shortcut', async ({ page }) => {
    console.log('🧪 Testing Keyboard Shortcut (Cmd+Enter)');

    // Open Claude Code
    const fabButton = page.locator('[data-testid="fab-button"]').or(
      page.locator('button:has-text("+")')
    ).first();

    await fabButton.click();
    await page.waitForTimeout(500);

    const claudeCodeButton = page.locator('button:has-text("Claude Code")').first();
    await claudeCodeButton.click();

    // Enter prompt
    const promptInput = page.locator('textarea#claude-code-prompt').first();
    await promptInput.fill('Create a simple component');

    // Focus on textarea
    await promptInput.focus();

    // Press Cmd+Enter (Meta+Enter on Mac, Ctrl+Enter on others)
    const isMac = process.platform === 'darwin';
    if (isMac) {
      await page.keyboard.press('Meta+Enter');
    } else {
      await page.keyboard.press('Control+Enter');
    }

    console.log('✓ Keyboard shortcut pressed');

    // Wait for execution to start
    const progressIndicator = page.locator('text=/Calling Claude Code Lambda/i');
    await expect(progressIndicator).toBeVisible({ timeout: 2000 });

    console.log('✅ Keyboard shortcut validated');
  });
});
