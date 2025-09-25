import { Page, expect } from '@playwright/test';
import { TestUserWithInvites, TestGroupWithInvites } from './invite-test-data';

/**
 * Helper class for testing invite graph system UI interactions
 */
export class InviteHelper {
  constructor(private page: Page) {}

  /**
   * Navigate to group management/invite section
   */
  async navigateToInviteManagement(): Promise<void> {
    // Open the sidebar if not already open
    const sidebarButton = this.page.locator('[data-testid="sidebar-toggle"]');
    if (await sidebarButton.isVisible()) {
      await sidebarButton.click();
    }

    // Wait for sidebar to be visible
    await this.page.waitForSelector('[data-testid="app-sidebar"]', { timeout: 5000 });
  }

  /**
   * Create a new invite code for the current group
   */
  async createInviteCode(maxUses: number = 50, expiresInDays?: number): Promise<string> {
    // Look for create invite code button
    const createButton = this.page.locator('[data-testid="create-invite-code-button"]');
    await expect(createButton).toBeVisible();
    await createButton.click();

    // If there's a modal/form for invite code settings
    const maxUsesInput = this.page.locator('[data-testid="invite-max-uses-input"]');
    if (await maxUsesInput.isVisible()) {
      await maxUsesInput.fill(maxUses.toString());
    }

    if (expiresInDays) {
      const expiryInput = this.page.locator('[data-testid="invite-expiry-input"]');
      if (await expiryInput.isVisible()) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiresInDays);
        await expiryInput.fill(expiryDate.toISOString().split('T')[0]);
      }
    }

    // Submit the form
    const submitButton = this.page.locator('[data-testid="create-invite-submit"]');
    if (await submitButton.isVisible()) {
      await submitButton.click();
    }

    // Wait for the invite code to appear
    const inviteCodeDisplay = this.page.locator('[data-testid="user-invite-code"]');
    await expect(inviteCodeDisplay).toBeVisible({ timeout: 10000 });

    // Get the generated invite code
    const inviteCode = await inviteCodeDisplay.textContent();
    if (!inviteCode) {
      throw new Error('Failed to generate invite code');
    }

    return inviteCode.trim();
  }

  /**
   * Get the current user's invite code for the active group
   */
  async getCurrentUserInviteCode(): Promise<string | null> {
    const inviteCodeDisplay = this.page.locator('[data-testid="user-invite-code"]');

    if (await inviteCodeDisplay.isVisible({ timeout: 3000 })) {
      const code = await inviteCodeDisplay.textContent();
      return code?.trim() || null;
    }

    return null;
  }

  /**
   * Copy invite code to clipboard
   */
  async copyInviteCode(): Promise<void> {
    const copyButton = this.page.locator('[data-testid="copy-invite-code-button"]');
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    // Wait for copy success feedback
    await expect(this.page.locator(':has-text("Copied!")')).toBeVisible({ timeout: 3000 });
  }

  /**
   * Get the invite URL for sharing
   */
  async getInviteUrl(): Promise<string> {
    // Click to show invite URL
    const showUrlButton = this.page.locator('[data-testid="show-invite-url-button"]');
    if (await showUrlButton.isVisible()) {
      await showUrlButton.click();
    }

    const inviteUrlInput = this.page.locator('[data-testid="invite-url-input"]');
    await expect(inviteUrlInput).toBeVisible();

    const url = await inviteUrlInput.inputValue();
    if (!url) {
      throw new Error('Failed to get invite URL');
    }

    return url;
  }

  /**
   * Join a group using an invite code
   */
  async joinGroupWithCode(inviteCode: string): Promise<void> {
    // Navigate to join group interface
    const joinButton = this.page.locator('[data-testid="join-group-button"]');
    await expect(joinButton).toBeVisible();
    await joinButton.click();

    // Fill in the invite code
    const inviteCodeInput = this.page.locator('[data-testid="join-code-input"]');
    await expect(inviteCodeInput).toBeVisible();
    await inviteCodeInput.fill(inviteCode);

    // Submit the join request
    const submitButton = this.page.locator('[data-testid="join-group-submit"]');
    await submitButton.click();

    // Wait for success message or group to be joined
    await Promise.race([
      this.page.waitForSelector('[data-testid="join-success-message"]', { timeout: 10000 }),
      this.page.waitForSelector('[data-testid="already-member-message"]', { timeout: 10000 }),
      this.page.waitForSelector('[data-testid="main-app"]', { timeout: 10000 })
    ]);
  }

  /**
   * Verify error message when joining with invalid code
   */
  async verifyJoinError(expectedErrorText: string): Promise<void> {
    const errorMessage = this.page.locator('[data-testid="join-error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(errorMessage).toContainText(expectedErrorText);
  }

  /**
   * View invite statistics for current user
   */
  async getInviteStats(): Promise<{
    inviteCode: string;
    currentUses: number;
    maxUses: number;
    successfulInvites: number;
  }> {
    const statsContainer = this.page.locator('[data-testid="invite-stats-container"]');
    await expect(statsContainer).toBeVisible();

    const inviteCode = await this.page.locator('[data-testid="invite-code-stat"]').textContent();
    const currentUsesText = await this.page.locator('[data-testid="current-uses-stat"]').textContent();
    const maxUsesText = await this.page.locator('[data-testid="max-uses-stat"]').textContent();
    const successfulInvitesText = await this.page.locator('[data-testid="successful-invites-stat"]').textContent();

    return {
      inviteCode: inviteCode?.trim() || '',
      currentUses: parseInt(currentUsesText?.match(/\d+/)?.[0] || '0'),
      maxUses: parseInt(maxUsesText?.match(/\d+/)?.[0] || '0'),
      successfulInvites: parseInt(successfulInvitesText?.match(/\d+/)?.[0] || '0')
    };
  }

  /**
   * Navigate to invite graph visualization
   */
  async navigateToInviteGraph(): Promise<void> {
    const graphButton = this.page.locator('[data-testid="view-invite-graph-button"]');
    await expect(graphButton).toBeVisible();
    await graphButton.click();

    // Wait for graph to load
    await this.page.waitForSelector('[data-testid="invite-graph-container"]', { timeout: 10000 });
  }

  /**
   * Verify invite graph displays correctly
   */
  async verifyInviteGraph(expectedStructure: {
    totalInvitations: number;
    activeInviters: number;
    rootMembers: number;
  }): Promise<void> {
    const graphContainer = this.page.locator('[data-testid="invite-graph-container"]');
    await expect(graphContainer).toBeVisible();

    // Check summary stats
    const totalInvitations = this.page.locator('[data-testid="total-invitations-stat"]');
    await expect(totalInvitations).toContainText(expectedStructure.totalInvitations.toString());

    const activeInviters = this.page.locator('[data-testid="active-inviters-stat"]');
    await expect(activeInviters).toContainText(expectedStructure.activeInviters.toString());

    const rootMembers = this.page.locator('[data-testid="root-members-stat"]');
    await expect(rootMembers).toContainText(expectedStructure.rootMembers.toString());
  }

  /**
   * Verify specific invitation relationship in graph
   */
  async verifyInvitationRelationship(inviterUsername: string, inviteeUsername: string): Promise<void> {
    // Look for the invitation relationship in the graph
    const relationshipLocator = this.page.locator(
      `[data-testid="invite-relationship"]:has-text("${inviterUsername}"):has-text("${inviteeUsername}")`
    );
    await expect(relationshipLocator).toBeVisible();
  }

  /**
   * Get all visible invitation relationships from the graph
   */
  async getInvitationRelationships(): Promise<Array<{
    inviter: string;
    invitee: string;
    level: number;
  }>> {
    const relationships: Array<{ inviter: string; invitee: string; level: number }> = [];

    const relationshipElements = this.page.locator('[data-testid="invite-relationship"]');
    const count = await relationshipElements.count();

    for (let i = 0; i < count; i++) {
      const element = relationshipElements.nth(i);
      const text = await element.textContent();
      const levelText = await element.getAttribute('data-level');

      if (text && levelText) {
        const [inviter, invitee] = text.split(' → ');
        relationships.push({
          inviter: inviter?.trim() || '',
          invitee: invitee?.trim() || '',
          level: parseInt(levelText)
        });
      }
    }

    return relationships;
  }

  /**
   * Deactivate current user's invite code
   */
  async deactivateInviteCode(): Promise<void> {
    const deactivateButton = this.page.locator('[data-testid="deactivate-invite-code-button"]');
    await expect(deactivateButton).toBeVisible();
    await deactivateButton.click();

    // Confirm deactivation if there's a confirmation dialog
    const confirmButton = this.page.locator('[data-testid="confirm-deactivate-button"]');
    if (await confirmButton.isVisible({ timeout: 3000 })) {
      await confirmButton.click();
    }

    // Wait for success message
    await expect(this.page.locator('[data-testid="deactivate-success-message"]')).toBeVisible({ timeout: 5000 });
  }

  /**
   * Verify group selector shows no global join code
   */
  async verifyNoGlobalJoinCode(): Promise<void> {
    // Should not see the old global join code display
    const globalCodeDisplay = this.page.locator(':has-text("Code:")').filter({ hasText: /^Code: [A-Z0-9]{6}$/ });
    await expect(globalCodeDisplay).not.toBeVisible();

    // Should see personal invite code messaging instead
    const personalCodeMessage = this.page.locator(':has-text("Click to view your invite code")');
    await expect(personalCodeMessage).toBeVisible();
  }

  /**
   * Switch to a different group to test multi-group invite codes
   */
  async switchToGroup(groupName: string): Promise<void> {
    const groupSelector = this.page.locator('[data-testid="group-selector"]');
    if (await groupSelector.isVisible()) {
      await groupSelector.selectOption({ label: groupName });
    } else {
      // Alternative: click on group name in sidebar
      const groupButton = this.page.locator(`[data-testid="group-button"]:has-text("${groupName}")`);
      await groupButton.click();
    }

    // Wait for group to be switched
    await this.page.waitForSelector(`[data-testid="current-group-name"]:has-text("${groupName}")`, { timeout: 5000 });
  }

  /**
   * Wait for invite system to be fully loaded
   */
  async waitForInviteSystemReady(): Promise<void> {
    // Wait for either invite code to be displayed or create button to be available
    await Promise.race([
      this.page.waitForSelector('[data-testid="user-invite-code"]', { timeout: 10000 }),
      this.page.waitForSelector('[data-testid="create-invite-code-button"]', { timeout: 10000 })
    ]);
  }
}