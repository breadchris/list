import { Page, expect } from '@playwright/test';

/**
 * UI Helper functions for E2E tests
 * Provides reusable functions for interacting with the app's UI components
 */

/**
 * Opens the ContentActionsDrawer by clicking the handle button
 */
export async function openDrawer(page: Page): Promise<void> {
  // Find drawer trigger by looking for the fixed bottom button with SVG chevron
  const drawerHandle = page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])');
  await drawerHandle.waitFor({ state: 'visible', timeout: 5000 });
  await drawerHandle.click();

  // Wait for drawer animation to complete
  await page.waitForTimeout(300);

  // Verify drawer is visible
  const drawer = page.locator('.bg-gray-800.rounded-t-2xl');
  await expect(drawer).toBeVisible({ timeout: 2000 });
}

/**
 * Selects an action from the ContentActionsDrawer
 * @param action - The action name (e.g., "AI Chat", "Import", "Claude Code")
 */
export async function selectDrawerAction(page: Page, action: string): Promise<void> {
  const actionButton = page.locator('button').filter({ hasText: action });
  await expect(actionButton).toBeVisible({ timeout: 2000 });
  await actionButton.click();

  // Wait for drawer to close
  await page.waitForTimeout(300);
}

/**
 * Types text into the Lexical content input
 */
export async function typeInContentInput(page: Page, text: string): Promise<void> {
  const contentEditable = page.locator('.lexical-content-editable');
  await expect(contentEditable).toBeVisible();

  // Click to focus
  await contentEditable.click();

  // Clear any existing text
  await contentEditable.fill('');

  // Type the text
  await contentEditable.fill(text);
}

/**
 * Submits content by pressing Enter in the input field
 */
export async function submitContent(page: Page): Promise<void> {
  const contentEditable = page.locator('.lexical-content-editable');
  await contentEditable.press('Enter');
}

/**
 * Waits for an AI assistant response to appear
 * @param timeout - Maximum time to wait in milliseconds (default: 30000)
 */
export async function waitForAssistantResponse(page: Page, timeout: number = 30000): Promise<void> {
  const assistantMessage = page.locator('.bg-blue-50.border-l-4.border-blue-500');
  await expect(assistantMessage).toBeVisible({ timeout });
}

/**
 * Verifies the content input has the correct active action styling
 * @param action - The action name (e.g., "ai-chat")
 * @param expectedColor - Expected border color in rgb format (e.g., "rgb(168, 85, 247)")
 */
export async function verifyInputStyling(
  page: Page,
  action: string | null,
  expectedColor?: string
): Promise<void> {
  const contentEditable = page.locator('.lexical-content-editable');

  if (action === null) {
    // No active action - should have default styling
    return;
  }

  // Check for colored left border
  const borderLeftWidth = await contentEditable.evaluate(el =>
    window.getComputedStyle(el).borderLeftWidth
  );
  expect(borderLeftWidth).toBe('4px');

  if (expectedColor) {
    const borderLeftColor = await contentEditable.evaluate(el =>
      window.getComputedStyle(el).borderLeftColor
    );
    expect(borderLeftColor).toBe(expectedColor);
  }
}

/**
 * Waits for a chat container to be created and visible
 */
export async function waitForChatContainer(page: Page, timeout: number = 10000): Promise<string> {
  const chatContainer = page.locator('[data-content-id]').filter({
    has: page.locator('text=/^Chat:/')
  }).first();

  await expect(chatContainer).toBeVisible({ timeout });

  // Get and return the chat content ID
  const chatId = await chatContainer.getAttribute('data-content-id');
  if (!chatId) throw new Error('Chat container missing data-content-id');

  return chatId;
}

/**
 * Navigates into a chat by clicking its container
 */
export async function navigateIntoChat(page: Page, chatId: string): Promise<void> {
  const chatContainer = page.locator(`[data-content-id="${chatId}"]`);
  await chatContainer.click();

  // Wait for navigation to complete
  await page.waitForURL(`**/?g=*&path=${chatId}*`, { timeout: 5000 });
}

/**
 * Counts the number of assistant messages visible on the page
 */
export async function countAssistantMessages(page: Page): Promise<number> {
  const assistantMessages = page.locator('.bg-blue-50.border-l-4.border-blue-500');
  return await assistantMessages.count();
}

/**
 * Verifies the drawer handle shows the active action
 */
export async function verifyDrawerHandleLabel(page: Page, expectedLabel: string | null): Promise<void> {
  const drawerHandle = page.locator('button:has(svg path[d*="M19 9l-7 7-7-7"])');

  if (expectedLabel) {
    const handleText = await drawerHandle.textContent();
    expect(handleText).toContain(expectedLabel);
  }
}

/**
 * Closes the drawer if it's open
 */
export async function closeDrawer(page: Page): Promise<void> {
  const drawer = page.locator('.bg-gray-800.rounded-t-2xl');
  const isVisible = await drawer.isVisible().catch(() => false);

  if (isVisible) {
    // Click outside the drawer to close it
    await page.click('body', { position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);
  }
}

/**
 * Waits for a toast notification with specific text
 */
export async function waitForToast(page: Page, text: string, timeout: number = 5000): Promise<void> {
  const toast = page.locator('.toast, [role="status"]').filter({ hasText: text });
  await expect(toast).toBeVisible({ timeout });
}
