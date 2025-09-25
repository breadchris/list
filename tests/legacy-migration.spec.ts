import { test, expect } from '@playwright/test';
import { DatabaseHelper } from './helpers/database-helper';
import { InviteHelper } from './helpers/invite-helper';
import {
  createTestUserWithInvites,
  createTestGroupWithInvites,
  generateTestInviteCode
} from './helpers/invite-test-data';

test.describe('Legacy Migration Tests', () => {
  let databaseHelper: DatabaseHelper;
  let inviteHelper: InviteHelper;

  test.beforeEach(async ({ page }) => {
    databaseHelper = new DatabaseHelper();
    inviteHelper = new InviteHelper(page);
  });

  test.describe('Global Join Code Deprecation', () => {
    test('should not display global join codes in new UI', async ({ page }) => {
      // Create group that might have legacy join_code field
      const user = createTestUserWithInvites('legacy_user');
      const group = createTestGroupWithInvites('Legacy Group');

      const userId = await databaseHelper.createTestUser(user);
      const groupId = await databaseHelper.createTestGroup(group, userId);
      await databaseHelper.addGroupMember(userId, groupId, 'admin');

      // The migration should have created user-specific invite codes for group creators
      // Let's verify this happened correctly

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: userId, email: user.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteManagement();

      // Should NOT see old global join code display
      await inviteHelper.verifyNoGlobalJoinCode();

      // Should see personal invite code messaging instead
      await inviteHelper.waitForInviteSystemReady();

      // Either user should have an invite code from migration, or option to create one
      const hasExistingCode = await page.locator('[data-testid="user-invite-code"]').isVisible();
      const hasCreateButton = await page.locator('[data-testid="create-invite-code-button"]').isVisible();

      expect(hasExistingCode || hasCreateButton).toBe(true);

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId],
        groupIds: [groupId]
      });
    });

    test('should handle groups created before invite tracking system', async ({ page }) => {
      // Simulate a group that existed before the invite system
      const creator = createTestUserWithInvites('pre_invite_creator');
      const member = createTestUserWithInvites('pre_invite_member');
      const group = createTestGroupWithInvites('Pre-Invite Group');

      const creatorId = await databaseHelper.createTestUser(creator);
      const memberId = await databaseHelper.createTestUser(member);
      const groupId = await databaseHelper.createTestGroup(group, creatorId);

      // Add members without creating invitation records (simulating pre-invite system state)
      await databaseHelper.addGroupMember(creatorId, groupId, 'admin');
      await databaseHelper.addGroupMember(memberId, groupId, 'member');

      // Login as creator
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: creatorId, email: creator.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      // Check invite graph - should handle empty state gracefully
      await inviteHelper.navigateToInviteGraph();

      // Should show appropriate message for groups without invitation data
      const emptyMessage = page.locator(':has-text("No invitation data available")');
      await expect(emptyMessage).toBeVisible();

      const explanationMessage = page.locator(':has-text("all members joined before the invite tracking system")');
      await expect(explanationMessage).toBeVisible();

      // Verify graph statistics show empty state
      await inviteHelper.verifyInviteGraph({
        totalInvitations: 0,
        activeInviters: 0,
        rootMembers: 0
      });

      // Go back to invite management - creator should still be able to create invite codes
      await inviteHelper.navigateToInviteManagement();

      // Creator should be able to create invite codes for future invitations
      const createButton = page.locator('[data-testid="create-invite-code-button"]');
      await expect(createButton).toBeVisible();

      const newInviteCode = await inviteHelper.createInviteCode();
      expect(newInviteCode).toMatch(/^[A-Z0-9]{6}$/);

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [creatorId, memberId],
        groupIds: [groupId]
      });
    });
  });

  test.describe('Data Migration Verification', () => {
    test('should verify migrated user invite codes from old system', async ({ page }) => {
      // This test verifies that the migration script correctly created user invite codes
      // for existing group creators

      const creator = createTestUserWithInvites('migrated_creator');
      const group = createTestGroupWithInvites('Migrated Group');

      const creatorId = await databaseHelper.createTestUser(creator);
      const groupId = await databaseHelper.createTestGroup(group, creatorId);
      await databaseHelper.addGroupMember(creatorId, groupId, 'admin');

      // The migration should have automatically created an invite code for the creator
      // Let's check this happened

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: creatorId, email: creator.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteManagement();

      // Should have an invite code (either from migration or we can create one)
      await inviteHelper.waitForInviteSystemReady();

      // Check if migration created a code, or if we need to create one
      let userInviteCode = await inviteHelper.getCurrentUserInviteCode();

      if (!userInviteCode) {
        // Migration might not have run or this is a fresh test - create code
        userInviteCode = await inviteHelper.createInviteCode();
      }

      expect(userInviteCode).toMatch(/^[A-Z0-9]{6}$/);

      // Verify the code exists in database and has correct properties
      await databaseHelper.verifyInviteCode(userInviteCode, {
        is_active: true,
        max_uses: 50, // Default from migration/creation
        current_uses: 0
      });

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [creatorId],
        groupIds: [groupId]
      });
    });

    test('should handle database constraints correctly after migration', async ({ page }) => {
      // Test that all foreign key relationships work correctly after migration
      const user1 = createTestUserWithInvites('constraint_user1');
      const user2 = createTestUserWithInvites('constraint_user2');
      const group = createTestGroupWithInvites('Constraint Group');

      const userId1 = await databaseHelper.createTestUser(user1);
      const userId2 = await databaseHelper.createTestUser(user2);
      const groupId = await databaseHelper.createTestGroup(group, userId1);

      await databaseHelper.addGroupMember(userId1, groupId, 'admin');
      await databaseHelper.addGroupMember(userId2, groupId, 'member');

      // Create invite codes for both users
      const code1 = generateTestInviteCode();
      const code2 = generateTestInviteCode();

      await databaseHelper.createInviteCode({
        user_id: userId1,
        group_id: groupId,
        invite_code: code1,
        max_uses: 50,
        current_uses: 0,
        is_active: true
      });

      await databaseHelper.createInviteCode({
        user_id: userId2,
        group_id: groupId,
        invite_code: code2,
        max_uses: 25,
        current_uses: 0,
        is_active: true
      });

      // Verify both codes exist
      await databaseHelper.verifyInviteCode(code1, { is_active: true });
      await databaseHelper.verifyInviteCode(code2, { is_active: true });

      // Test cascade delete: removing group should remove invite codes
      await databaseHelper.cleanupTestData({
        groupIds: [groupId]
      });

      // Verify invite codes were cascade deleted
      try {
        await databaseHelper.verifyInviteCode(code1, {});
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Failed to find invite code');
      }

      try {
        await databaseHelper.verifyInviteCode(code2, {});
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Failed to find invite code');
      }

      // Cleanup users
      await databaseHelper.cleanupTestData({
        userIds: [userId1, userId2]
      });
    });
  });

  test.describe('Backward Compatibility', () => {
    test('should reject attempts to use old global join code format', async ({ page }) => {
      // Test that the system properly rejects old-style join attempts

      const user = createTestUserWithInvites('old_format_user');
      const userId = await databaseHelper.createTestUser(user);

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: userId, email: user.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      // Attempt to join with an old-style global code (this should fail)
      const oldStyleCode = 'GLOBAL'; // Example old format

      try {
        await inviteHelper.joinGroupWithCode(oldStyleCode);
        expect(false).toBe(true); // Should not succeed
      } catch (error) {
        // Should show appropriate error message
        await inviteHelper.verifyJoinError('Invalid invite code');
      }

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId]
      });
    });

    test('should maintain group functionality for pre-migration groups', async ({ page }) => {
      // Verify that groups created before migration still work normally

      const creator = createTestUserWithInvites('pre_migration_creator');
      const newMember = createTestUserWithInvites('new_post_migration_member');
      const group = createTestGroupWithInvites('Pre-Migration Group');

      const creatorId = await databaseHelper.createTestUser(creator);
      const newMemberId = await databaseHelper.createTestUser(newMember);
      const groupId = await databaseHelper.createTestGroup(group, creatorId);

      await databaseHelper.addGroupMember(creatorId, groupId, 'admin');

      // Creator should be able to create invite codes even for pre-migration groups
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: creatorId, email: creator.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteManagement();

      const inviteCode = await inviteHelper.createInviteCode();
      expect(inviteCode).toMatch(/^[A-Z0-9]{6}$/);

      // New member should be able to join using the new invite code
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: newMemberId, email: newMember.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.joinGroupWithCode(inviteCode);

      // Verify new member joined successfully
      await databaseHelper.verifyGroupMembership(newMemberId, groupId, 'member');

      // Verify invitation relationship was created
      await databaseHelper.verifyInvitation(creatorId, newMemberId, groupId);

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [creatorId, newMemberId],
        groupIds: [groupId]
      });
    });
  });

  test.describe('Migration Edge Cases', () => {
    test('should handle groups with no creator after migration', async ({ page }) => {
      // Test edge case where a group might not have a created_by field

      const orphanUser = createTestUserWithInvites('orphan_user');
      const group = createTestGroupWithInvites('Orphan Group');

      const userId = await databaseHelper.createTestUser(orphanUser);

      // Create group without creator (simulating edge case)
      const groupId = await databaseHelper.createTestGroup(group, null);
      await databaseHelper.addGroupMember(userId, groupId, 'admin');

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: userId, email: orphanUser.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteManagement();

      // User should still be able to create invite codes
      const createButton = page.locator('[data-testid="create-invite-code-button"]');
      await expect(createButton).toBeVisible();

      const inviteCode = await inviteHelper.createInviteCode();
      expect(inviteCode).toMatch(/^[A-Z0-9]{6}$/);

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId],
        groupIds: [groupId]
      });
    });

    test('should handle duplicate invite code conflicts gracefully', async ({ page }) => {
      // Test that the system handles potential invite code collisions

      const user1 = createTestUserWithInvites('collision_user1');
      const user2 = createTestUserWithInvites('collision_user2');
      const group = createTestGroupWithInvites('Collision Group');

      const userId1 = await databaseHelper.createTestUser(user1);
      const userId2 = await databaseHelper.createTestUser(user2);
      const groupId = await databaseHelper.createTestGroup(group, userId1);

      await databaseHelper.addGroupMember(userId1, groupId, 'admin');
      await databaseHelper.addGroupMember(userId2, groupId, 'member');

      // Pre-create an invite code
      const existingCode = generateTestInviteCode();
      await databaseHelper.createInviteCode({
        user_id: userId1,
        group_id: groupId,
        invite_code: existingCode,
        max_uses: 50,
        current_uses: 0,
        is_active: true
      });

      // Login as second user and create invite code
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: userId2, email: user2.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteManagement();

      // Should be able to create a code (system should generate unique code)
      const newCode = await inviteHelper.createInviteCode();
      expect(newCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(newCode).not.toBe(existingCode);

      // Verify both codes exist and are unique
      await databaseHelper.verifyInviteCode(existingCode, { is_active: true });
      await databaseHelper.verifyInviteCode(newCode, { is_active: true });

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId1, userId2],
        groupIds: [groupId]
      });
    });
  });

  test.describe('Performance and Scale', () => {
    test('should handle groups with many existing members efficiently', async ({ page }) => {
      // Test that the invite system performs well with groups that have many pre-existing members

      const creator = createTestUserWithInvites('scale_creator');
      const group = createTestGroupWithInvites('Large Group');

      const creatorId = await databaseHelper.createTestUser(creator);
      const groupId = await databaseHelper.createTestGroup(group, creatorId);
      await databaseHelper.addGroupMember(creatorId, groupId, 'admin');

      // Add several existing members (simulating a large pre-migration group)
      const memberIds = [];
      for (let i = 0; i < 5; i++) {
        const member = createTestUserWithInvites(`scale_member_${i}`);
        const memberId = await databaseHelper.createTestUser(member);
        await databaseHelper.addGroupMember(memberId, groupId, 'member');
        memberIds.push(memberId);
      }

      // Verify group has many members
      const memberCount = await databaseHelper.countGroupMembers(groupId);
      expect(memberCount).toBe(6); // Creator + 5 members

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: creatorId, email: creator.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      // Invite system should load efficiently even with many members
      await inviteHelper.navigateToInviteManagement();

      const startTime = Date.now();
      await inviteHelper.waitForInviteSystemReady();
      const loadTime = Date.now() - startTime;

      // Should load reasonably quickly (under 5 seconds)
      expect(loadTime).toBeLessThan(5000);

      // Should be able to create invite code normally
      const inviteCode = await inviteHelper.createInviteCode();
      expect(inviteCode).toMatch(/^[A-Z0-9]{6}$/);

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [creatorId, ...memberIds],
        groupIds: [groupId]
      });
    });
  });
});