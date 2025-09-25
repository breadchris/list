import { test, expect } from '@playwright/test';
import { DatabaseHelper } from './helpers/database-helper';
import { InviteHelper } from './helpers/invite-helper';
import {
  createSimpleInvitationChain,
  createTestUserWithInvites,
  createTestGroupWithInvites,
  generateTestInviteCode,
  createExpiredInviteCode,
  createMaxedOutInviteCode,
  createDeactivatedInviteCode
} from './helpers/invite-test-data';

test.describe('Invite System', () => {
  let databaseHelper: DatabaseHelper;
  let inviteHelper: InviteHelper;

  test.beforeEach(async ({ page }) => {
    databaseHelper = new DatabaseHelper();
    inviteHelper = new InviteHelper(page);
  });

  test.afterEach(async () => {
    // Cleanup is handled by the test setup itself
  });

  test.describe('User Invite Code Creation', () => {
    test('should create user-specific invite code for group member', async ({ page }) => {
      // Setup test user and group
      const user = createTestUserWithInvites('creator');
      const group = createTestGroupWithInvites('Test Group');

      const userId = await databaseHelper.createTestUser(user);
      const groupId = await databaseHelper.createTestGroup(group, userId);
      await databaseHelper.addGroupMember(userId, groupId, 'admin');

      // Navigate to app and login (mock auth for testing)
      await page.goto('/');

      // Mock authentication state
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: userId, email: user.email });

      await page.reload();

      // Wait for app to load
      await page.waitForSelector('[data-testid="main-app"]');

      // Open sidebar to access invite management
      await inviteHelper.navigateToInviteManagement();

      // Wait for invite system to be ready
      await inviteHelper.waitForInviteSystemReady();

      // Create invite code
      const inviteCode = await inviteHelper.createInviteCode(50, 30);

      // Verify invite code is displayed
      expect(inviteCode).toMatch(/^[A-Z0-9]{6}$/);

      // Verify in database
      await databaseHelper.verifyInviteCode(inviteCode, {
        current_uses: 0,
        max_uses: 50,
        is_active: true
      });

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId],
        groupIds: [groupId]
      });
    });

    test('should display existing invite code for user', async ({ page }) => {
      // Setup user with existing invite code
      const user = createTestUserWithInvites('existing');
      const group = createTestGroupWithInvites('Existing Group');
      const existingCode = generateTestInviteCode();

      const userId = await databaseHelper.createTestUser(user);
      const groupId = await databaseHelper.createTestGroup(group, userId);
      await databaseHelper.addGroupMember(userId, groupId, 'member');

      // Create existing invite code
      await databaseHelper.createInviteCode({
        user_id: userId,
        group_id: groupId,
        invite_code: existingCode,
        max_uses: 25,
        current_uses: 5,
        is_active: true
      });

      // Login and navigate
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

      // Verify existing code is displayed
      const displayedCode = await inviteHelper.getCurrentUserInviteCode();
      expect(displayedCode).toBe(existingCode);

      // Verify usage stats
      const stats = await inviteHelper.getInviteStats();
      expect(stats.currentUses).toBe(5);
      expect(stats.maxUses).toBe(25);

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId],
        groupIds: [groupId]
      });
    });
  });

  test.describe('Group Joining with Invite Codes', () => {
    test('should successfully join group with valid invite code', async ({ page }) => {
      // Setup invitation chain: User A creates group and invite code
      const chain = createSimpleInvitationChain();
      const setupResult = await databaseHelper.setupInvitationChain(chain);

      const userA = chain.users[0];
      const userB = chain.users[1];
      const inviteCodeA = userA.inviteCodes![0].invite_code;

      // User B joins using User A's invite code
      await page.goto('/');

      // Mock auth as User B
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: setupResult.userIds[1], email: userB.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      // Join group using invite code
      await inviteHelper.joinGroupWithCode(inviteCodeA);

      // Verify successful join
      await page.waitForSelector('[data-testid="main-app"]', { timeout: 10000 });

      // Verify User B is now a group member
      await databaseHelper.verifyGroupMembership(
        setupResult.userIds[1],
        setupResult.groupId,
        'member'
      );

      // Verify invitation relationship was created
      await databaseHelper.verifyInvitation(
        setupResult.userIds[0], // User A (inviter)
        setupResult.userIds[1], // User B (invitee)
        setupResult.groupId
      );

      // Verify invite code usage was incremented
      await databaseHelper.verifyInviteCode(inviteCodeA, {
        current_uses: 1
      });

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: setupResult.userIds,
        groupIds: [setupResult.groupId]
      });
    });

    test('should reject invalid invite code', async ({ page }) => {
      const user = createTestUserWithInvites('joiner');
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

      // Attempt to join with invalid code
      const invalidCode = 'INVALID123';

      try {
        await inviteHelper.joinGroupWithCode(invalidCode);
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Verify error message is shown
        await inviteHelper.verifyJoinError('Invalid invite code');
      }

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId]
      });
    });

    test('should reject expired invite code', async ({ page }) => {
      // Setup user and group with expired invite code
      const user = createTestUserWithInvites('creator');
      const joiner = createTestUserWithInvites('joiner');
      const group = createTestGroupWithInvites('Expired Group');

      const userId = await databaseHelper.createTestUser(user);
      const joinerId = await databaseHelper.createTestUser(joiner);
      const groupId = await databaseHelper.createTestGroup(group, userId);
      await databaseHelper.addGroupMember(userId, groupId, 'admin');

      // Create expired invite code
      const expiredCode = createExpiredInviteCode(userId, groupId);
      await databaseHelper.createInviteCode(expiredCode);

      // Attempt join as joiner
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: joinerId, email: joiner.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      try {
        await inviteHelper.joinGroupWithCode(expiredCode.invite_code);
        expect(false).toBe(true);
      } catch (error) {
        await inviteHelper.verifyJoinError('expired');
      }

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId, joinerId],
        groupIds: [groupId]
      });
    });

    test('should reject maxed out invite code', async ({ page }) => {
      const user = createTestUserWithInvites('creator');
      const joiner = createTestUserWithInvites('joiner');
      const group = createTestGroupWithInvites('Maxed Group');

      const userId = await databaseHelper.createTestUser(user);
      const joinerId = await databaseHelper.createTestUser(joiner);
      const groupId = await databaseHelper.createTestGroup(group, userId);
      await databaseHelper.addGroupMember(userId, groupId, 'admin');

      // Create maxed out invite code
      const maxedCode = createMaxedOutInviteCode(userId, groupId);
      await databaseHelper.createInviteCode(maxedCode);

      // Attempt join
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: joinerId, email: joiner.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      try {
        await inviteHelper.joinGroupWithCode(maxedCode.invite_code);
        expect(false).toBe(true);
      } catch (error) {
        await inviteHelper.verifyJoinError('maximum uses');
      }

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId, joinerId],
        groupIds: [groupId]
      });
    });

    test('should reject deactivated invite code', async ({ page }) => {
      const user = createTestUserWithInvites('creator');
      const joiner = createTestUserWithInvites('joiner');
      const group = createTestGroupWithInvites('Deactivated Group');

      const userId = await databaseHelper.createTestUser(user);
      const joinerId = await databaseHelper.createTestUser(joiner);
      const groupId = await databaseHelper.createTestGroup(group, userId);
      await databaseHelper.addGroupMember(userId, groupId, 'admin');

      // Create deactivated invite code
      const deactivatedCode = createDeactivatedInviteCode(userId, groupId);
      await databaseHelper.createInviteCode(deactivatedCode);

      // Attempt join
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: joinerId, email: joiner.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      try {
        await inviteHelper.joinGroupWithCode(deactivatedCode.invite_code);
        expect(false).toBe(true);
      } catch (error) {
        await inviteHelper.verifyJoinError('deactivated');
      }

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId, joinerId],
        groupIds: [groupId]
      });
    });
  });

  test.describe('Invite Code Management', () => {
    test('should allow user to deactivate their invite code', async ({ page }) => {
      const user = createTestUserWithInvites('owner');
      const group = createTestGroupWithInvites('Management Group');

      const userId = await databaseHelper.createTestUser(user);
      const groupId = await databaseHelper.createTestGroup(group, userId);
      await databaseHelper.addGroupMember(userId, groupId, 'admin');

      // Create active invite code
      const activeCode = generateTestInviteCode();
      await databaseHelper.createInviteCode({
        user_id: userId,
        group_id: groupId,
        invite_code: activeCode,
        max_uses: 50,
        current_uses: 3,
        is_active: true
      });

      // Login and navigate
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

      // Deactivate the invite code
      await inviteHelper.deactivateInviteCode();

      // Verify code is deactivated in database
      await databaseHelper.verifyInviteCode(activeCode, {
        is_active: false
      });

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId],
        groupIds: [groupId]
      });
    });

    test('should show invite URL for sharing', async ({ page }) => {
      const user = createTestUserWithInvites('sharer');
      const group = createTestGroupWithInvites('Share Group');

      const userId = await databaseHelper.createTestUser(user);
      const groupId = await databaseHelper.createTestGroup(group, userId);
      await databaseHelper.addGroupMember(userId, groupId, 'member');

      const shareCode = generateTestInviteCode();
      await databaseHelper.createInviteCode({
        user_id: userId,
        group_id: groupId,
        invite_code: shareCode,
        max_uses: 50,
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

      await inviteHelper.navigateToInviteManagement();

      // Get invite URL
      const inviteUrl = await inviteHelper.getInviteUrl();

      // Verify URL format
      expect(inviteUrl).toContain(`/invite/${shareCode}`);
      expect(inviteUrl).toMatch(/^https?:\/\/.+/);

      // Test copy functionality
      await inviteHelper.copyInviteCode();

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId],
        groupIds: [groupId]
      });
    });
  });

  test.describe('Legacy System Migration', () => {
    test('should handle groups without invite tracking gracefully', async ({ page }) => {
      // This test ensures the system works with groups created before invite tracking
      const user = createTestUserWithInvites('legacy');
      const group = createTestGroupWithInvites('Legacy Group');

      const userId = await databaseHelper.createTestUser(user);
      const groupId = await databaseHelper.createTestGroup(group, userId);
      await databaseHelper.addGroupMember(userId, groupId, 'admin');

      // Don't create any invite codes - simulate legacy group

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

      // Should show option to create invite code
      const createButton = page.locator('[data-testid="create-invite-code-button"]');
      await expect(createButton).toBeVisible();

      // Verify no global join code is shown
      await inviteHelper.verifyNoGlobalJoinCode();

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId],
        groupIds: [groupId]
      });
    });
  });
});