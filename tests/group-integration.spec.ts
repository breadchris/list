import { test, expect } from '@playwright/test';
import { DatabaseHelper } from './helpers/database-helper';
import { InviteHelper } from './helpers/invite-helper';
import {
  createTestUserWithInvites,
  createTestGroupWithInvites,
  generateTestInviteCode,
  createSimpleInvitationChain
} from './helpers/invite-test-data';

test.describe('Group Integration with Invite System', () => {
  let databaseHelper: DatabaseHelper;
  let inviteHelper: InviteHelper;

  test.beforeEach(async ({ page }) => {
    databaseHelper = new DatabaseHelper();
    inviteHelper = new InviteHelper(page);
  });

  test.describe('Group Creation and Invite Setup', () => {
    test('should automatically set up invite capabilities for new group creator', async ({ page }) => {
      const user = createTestUserWithInvites('creator');
      const userId = await databaseHelper.createTestUser(user);

      // Login
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: userId, email: user.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      // Create a new group through UI
      await page.click('[data-testid="sidebar-toggle"]');
      await page.waitForSelector('[data-testid="app-sidebar"]');
      await page.click('[data-testid="create-group-button"]');

      // Fill in group creation modal
      await page.fill('input[placeholder*="group name"]', 'New Test Group');
      await page.click('button:has-text("Create Group")');

      // Wait for group creation to complete
      await page.waitForSelector('[data-testid="current-group-name"]:has-text("New Test Group")', { timeout: 10000 });

      // Verify creator can immediately create invite codes
      await page.click('[data-testid="sidebar-toggle"]');
      await page.waitForSelector('[data-testid="app-sidebar"]');

      await inviteHelper.waitForInviteSystemReady();

      // Should show option to create invite code (since creator automatically gets membership)
      const createButton = page.locator('[data-testid="create-invite-code-button"]');
      await expect(createButton).toBeVisible();

      // Create invite code
      const inviteCode = await inviteHelper.createInviteCode();
      expect(inviteCode).toMatch(/^[A-Z0-9]{6}$/);

      // Cleanup - get group info first
      const groupName = await page.locator('[data-testid="current-group-name"]').textContent();
      const groups = await databaseHelper.getGroupsByName(groupName!);

      await databaseHelper.cleanupTestData({
        userIds: [userId],
        groupIds: groups.map(g => g.id)
      });
    });

    test('should handle multiple groups with separate invite codes', async ({ page }) => {
      const user = createTestUserWithInvites('multigroup');
      const group1 = createTestGroupWithInvites('Group One');
      const group2 = createTestGroupWithInvites('Group Two');

      const userId = await databaseHelper.createTestUser(user);
      const groupId1 = await databaseHelper.createTestGroup(group1, userId);
      const groupId2 = await databaseHelper.createTestGroup(group2, userId);

      await databaseHelper.addGroupMember(userId, groupId1, 'admin');
      await databaseHelper.addGroupMember(userId, groupId2, 'admin');

      // Create different invite codes for each group
      const code1 = generateTestInviteCode();
      const code2 = generateTestInviteCode();

      await databaseHelper.createInviteCode({
        user_id: userId,
        group_id: groupId1,
        invite_code: code1,
        max_uses: 25,
        current_uses: 0,
        is_active: true
      });

      await databaseHelper.createInviteCode({
        user_id: userId,
        group_id: groupId2,
        invite_code: code2,
        max_uses: 50,
        current_uses: 5,
        is_active: true
      });

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: userId, email: user.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      // Switch between groups and verify different invite codes
      await inviteHelper.switchToGroup(group1.name);
      await inviteHelper.navigateToInviteManagement();

      let currentCode = await inviteHelper.getCurrentUserInviteCode();
      expect(currentCode).toBe(code1);

      let stats = await inviteHelper.getInviteStats();
      expect(stats.maxUses).toBe(25);
      expect(stats.currentUses).toBe(0);

      // Switch to second group
      await inviteHelper.switchToGroup(group2.name);
      await inviteHelper.navigateToInviteManagement();

      currentCode = await inviteHelper.getCurrentUserInviteCode();
      expect(currentCode).toBe(code2);

      stats = await inviteHelper.getInviteStats();
      expect(stats.maxUses).toBe(50);
      expect(stats.currentUses).toBe(5);

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId],
        groupIds: [groupId1, groupId2]
      });
    });
  });

  test.describe('Member Management Integration', () => {
    test('should update group member count when users join via invite', async ({ page }) => {
      const chain = createSimpleInvitationChain();
      const setupResult = await databaseHelper.setupInvitationChain(chain);

      const creatorUser = chain.users[0];
      const joinerUser = chain.users[1];
      const inviteCode = creatorUser.inviteCodes![0].invite_code;

      // Initial member count should be all users in chain
      const initialCount = await databaseHelper.countGroupMembers(setupResult.groupId);
      expect(initialCount).toBe(3); // All users are already set up as members

      // Login as creator to monitor group
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: setupResult.userIds[0], email: creatorUser.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      // Verify all members are properly set up
      for (let i = 0; i < setupResult.userIds.length; i++) {
        await databaseHelper.verifyGroupMembership(
          setupResult.userIds[i],
          setupResult.groupId,
          i === 0 ? 'admin' : 'member'
        );
      }

      // Check that invitation relationships are properly tracked
      await inviteHelper.navigateToInviteGraph();
      await inviteHelper.verifyInviteGraph({
        totalInvitations: 2, // A→B, B→C
        activeInviters: 2,   // A and B
        rootMembers: 1       // A is root
      });

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: setupResult.userIds,
        groupIds: [setupResult.groupId]
      });
    });

    test('should handle user joining multiple groups with different invite codes', async ({ page }) => {
      // Create multiple groups with different owners
      const owner1 = createTestUserWithInvites('owner1');
      const owner2 = createTestUserWithInvites('owner2');
      const joiner = createTestUserWithInvites('joiner');

      const group1 = createTestGroupWithInvites('Multi Group 1');
      const group2 = createTestGroupWithInvites('Multi Group 2');

      const ownerId1 = await databaseHelper.createTestUser(owner1);
      const ownerId2 = await databaseHelper.createTestUser(owner2);
      const joinerId = await databaseHelper.createTestUser(joiner);

      const groupId1 = await databaseHelper.createTestGroup(group1, ownerId1);
      const groupId2 = await databaseHelper.createTestGroup(group2, ownerId2);

      await databaseHelper.addGroupMember(ownerId1, groupId1, 'admin');
      await databaseHelper.addGroupMember(ownerId2, groupId2, 'admin');

      // Create invite codes for both groups
      const code1 = generateTestInviteCode();
      const code2 = generateTestInviteCode();

      await databaseHelper.createInviteCode({
        user_id: ownerId1,
        group_id: groupId1,
        invite_code: code1,
        max_uses: 50,
        current_uses: 0,
        is_active: true
      });

      await databaseHelper.createInviteCode({
        user_id: ownerId2,
        group_id: groupId2,
        invite_code: code2,
        max_uses: 50,
        current_uses: 0,
        is_active: true
      });

      // Login as joiner
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: joinerId, email: joiner.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      // Join first group
      await inviteHelper.joinGroupWithCode(code1);
      await page.waitForSelector('[data-testid="main-app"]');

      // Verify membership in first group
      await databaseHelper.verifyGroupMembership(joinerId, groupId1, 'member');

      // Join second group
      await inviteHelper.joinGroupWithCode(code2);
      await page.waitForSelector('[data-testid="main-app"]');

      // Verify membership in both groups
      await databaseHelper.verifyGroupMembership(joinerId, groupId1, 'member');
      await databaseHelper.verifyGroupMembership(joinerId, groupId2, 'member');

      // Verify invitation relationships are tracked for both
      await databaseHelper.verifyInvitation(ownerId1, joinerId, groupId1);
      await databaseHelper.verifyInvitation(ownerId2, joinerId, groupId2);

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [ownerId1, ownerId2, joinerId],
        groupIds: [groupId1, groupId2]
      });
    });
  });

  test.describe('Group Settings and Permissions', () => {
    test('should respect group member permissions for invite code management', async ({ page }) => {
      const admin = createTestUserWithInvites('admin');
      const member = createTestUserWithInvites('member');
      const group = createTestGroupWithInvites('Permission Group');

      const adminId = await databaseHelper.createTestUser(admin);
      const memberId = await databaseHelper.createTestUser(member);
      const groupId = await databaseHelper.createTestGroup(group, adminId);

      await databaseHelper.addGroupMember(adminId, groupId, 'admin');
      await databaseHelper.addGroupMember(memberId, groupId, 'member');

      // Test as admin first
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: adminId, email: admin.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteManagement();

      // Admin should be able to create invite codes
      const adminCreateButton = page.locator('[data-testid="create-invite-code-button"]');
      await expect(adminCreateButton).toBeVisible();

      const adminInviteCode = await inviteHelper.createInviteCode();
      expect(adminInviteCode).toMatch(/^[A-Z0-9]{6}$/);

      // Now test as regular member
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: memberId, email: member.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteManagement();

      // Regular member should also be able to create invite codes (user-specific system)
      const memberCreateButton = page.locator('[data-testid="create-invite-code-button"]');
      await expect(memberCreateButton).toBeVisible();

      const memberInviteCode = await inviteHelper.createInviteCode();
      expect(memberInviteCode).toMatch(/^[A-Z0-9]{6}$/);

      // Codes should be different
      expect(memberInviteCode).not.toBe(adminInviteCode);

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [adminId, memberId],
        groupIds: [groupId]
      });
    });

    test('should show different invite statistics for different users', async ({ page }) => {
      const activeInviter = createTestUserWithInvites('active');
      const passiveUser = createTestUserWithInvites('passive');
      const group = createTestGroupWithInvites('Stats Group');

      const activerId = await databaseHelper.createTestUser(activeInviter);
      const passiveId = await databaseHelper.createTestUser(passiveUser);
      const groupId = await databaseHelper.createTestGroup(group, activerId);

      await databaseHelper.addGroupMember(activerId, groupId, 'admin');
      await databaseHelper.addGroupMember(passiveId, groupId, 'member');

      // Create invite code for active user with some usage
      const activeCode = generateTestInviteCode();
      await databaseHelper.createInviteCode({
        user_id: activerId,
        group_id: groupId,
        invite_code: activeCode,
        max_uses: 50,
        current_uses: 10,
        is_active: true
      });

      // Check stats as active inviter
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: activerId, email: activeInviter.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteManagement();

      const activeStats = await inviteHelper.getInviteStats();
      expect(activeStats.inviteCode).toBe(activeCode);
      expect(activeStats.currentUses).toBe(10);
      expect(activeStats.maxUses).toBe(50);

      // Check as passive user (no invite code yet)
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: passiveId, email: passiveUser.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteManagement();

      // Should show option to create invite code
      const createButton = page.locator('[data-testid="create-invite-code-button"]');
      await expect(createButton).toBeVisible();

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [activerId, passiveId],
        groupIds: [groupId]
      });
    });
  });

  test.describe('Group Navigation and Context', () => {
    test('should maintain invite context when switching groups', async ({ page }) => {
      const user = createTestUserWithInvites('switcher');
      const group1 = createTestGroupWithInvites('Context Group 1');
      const group2 = createTestGroupWithInvites('Context Group 2');

      const userId = await databaseHelper.createTestUser(user);
      const groupId1 = await databaseHelper.createTestGroup(group1, userId);
      const groupId2 = await databaseHelper.createTestGroup(group2, userId);

      await databaseHelper.addGroupMember(userId, groupId1, 'admin');
      await databaseHelper.addGroupMember(userId, groupId2, 'member');

      const code1 = generateTestInviteCode();
      const code2 = generateTestInviteCode();

      await databaseHelper.createInviteCode({
        user_id: userId,
        group_id: groupId1,
        invite_code: code1,
        max_uses: 25,
        current_uses: 2,
        is_active: true
      });

      await databaseHelper.createInviteCode({
        user_id: userId,
        group_id: groupId2,
        invite_code: code2,
        max_uses: 100,
        current_uses: 0,
        is_active: true
      });

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: userId, email: user.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      // Start in group 1
      await inviteHelper.switchToGroup(group1.name);
      await inviteHelper.navigateToInviteManagement();

      const stats1 = await inviteHelper.getInviteStats();
      expect(stats1.inviteCode).toBe(code1);
      expect(stats1.currentUses).toBe(2);

      // Switch to group 2
      await inviteHelper.switchToGroup(group2.name);
      await inviteHelper.navigateToInviteManagement();

      const stats2 = await inviteHelper.getInviteStats();
      expect(stats2.inviteCode).toBe(code2);
      expect(stats2.currentUses).toBe(0);

      // Switch back to group 1
      await inviteHelper.switchToGroup(group1.name);
      await inviteHelper.navigateToInviteManagement();

      const stats1Again = await inviteHelper.getInviteStats();
      expect(stats1Again.inviteCode).toBe(code1);
      expect(stats1Again.currentUses).toBe(2);

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId],
        groupIds: [groupId1, groupId2]
      });
    });

    test('should handle group deletion with existing invite codes', async ({ page }) => {
      const owner = createTestUserWithInvites('owner');
      const group = createTestGroupWithInvites('Deletable Group');

      const ownerId = await databaseHelper.createTestUser(owner);
      const groupId = await databaseHelper.createTestGroup(group, ownerId);
      await databaseHelper.addGroupMember(ownerId, groupId, 'admin');

      const inviteCode = generateTestInviteCode();
      await databaseHelper.createInviteCode({
        user_id: ownerId,
        group_id: groupId,
        invite_code: inviteCode,
        max_uses: 50,
        current_uses: 5,
        is_active: true
      });

      // Verify invite code exists
      await databaseHelper.verifyInviteCode(inviteCode, {
        current_uses: 5,
        is_active: true
      });

      // Delete the group (this should cascade delete invite codes)
      await databaseHelper.cleanupTestData({
        groupIds: [groupId]
      });

      // Verify invite code was also deleted due to foreign key constraints
      try {
        await databaseHelper.verifyInviteCode(inviteCode, {});
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        // Expected - invite code should be gone
        expect(error.message).toContain('Failed to find invite code');
      }

      // Cleanup user
      await databaseHelper.cleanupTestData({
        userIds: [ownerId]
      });
    });
  });
});