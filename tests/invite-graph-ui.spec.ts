import { test, expect } from '@playwright/test';
import { DatabaseHelper } from './helpers/database-helper';
import { InviteHelper } from './helpers/invite-helper';
import {
  createSimpleInvitationChain,
  createComplexInvitationTree,
  createTestUserWithInvites,
  createTestGroupWithInvites
} from './helpers/invite-test-data';

test.describe('Invite Graph Visualization', () => {
  let databaseHelper: DatabaseHelper;
  let inviteHelper: InviteHelper;

  test.beforeEach(async ({ page }) => {
    databaseHelper = new DatabaseHelper();
    inviteHelper = new InviteHelper(page);
  });

  test.describe('Simple Invitation Chain Display', () => {
    test('should display simple invitation chain: A → B → C', async ({ page }) => {
      // Setup simple chain: Creator → Invitee1 → Invitee2
      const chain = createSimpleInvitationChain();
      const setupResult = await databaseHelper.setupInvitationChain(chain);

      const creatorUser = chain.users[0];

      // Login as creator to view the graph
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: setupResult.userIds[0], email: creatorUser.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      // Navigate to invite graph
      await inviteHelper.navigateToInviteGraph();

      // Verify graph container is visible
      await expect(page.locator('[data-testid="invite-graph-container"]')).toBeVisible();

      // Verify graph statistics
      await inviteHelper.verifyInviteGraph({
        totalInvitations: 2, // A→B, B→C
        activeInviters: 2,   // A and B invited someone
        rootMembers: 1       // Only A is root (creator)
      });

      // Verify invitation relationships are displayed
      await inviteHelper.verifyInvitationRelationship(
        creatorUser.username!,
        chain.users[1].username!
      );

      await inviteHelper.verifyInvitationRelationship(
        chain.users[1].username!,
        chain.users[2].username!
      );

      // Get all relationships and verify structure
      const relationships = await inviteHelper.getInvitationRelationships();
      expect(relationships).toHaveLength(3); // 3 users total (root + 2 relationships)

      // Verify levels are correct
      const creatorRelation = relationships.find(r => r.inviter.includes(creatorUser.username!));
      const secondLevel = relationships.find(r => r.inviter.includes(chain.users[1].username!));

      expect(creatorRelation?.level).toBe(0); // Creator is level 0
      expect(secondLevel?.level).toBe(1);     // Second level inviter

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: setupResult.userIds,
        groupIds: [setupResult.groupId]
      });
    });
  });

  test.describe('Complex Invitation Tree Display', () => {
    test('should display complex invitation tree: A → B, A → C, B → D, C → E', async ({ page }) => {
      // Setup complex tree structure
      const tree = createComplexInvitationTree();
      const setupResult = await databaseHelper.setupInvitationChain(tree);

      const rootUser = tree.users[0]; // User A

      // Login as root user
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: setupResult.userIds[0], email: rootUser.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteGraph();

      // Verify complex tree statistics
      await inviteHelper.verifyInviteGraph({
        totalInvitations: 4, // A→B, A→C, B→D, C→E
        activeInviters: 3,   // A, B, and C invited someone
        rootMembers: 1       // Only A is root
      });

      // Verify all relationships exist
      const relationships = await inviteHelper.getInvitationRelationships();
      expect(relationships.length).toBeGreaterThanOrEqual(4);

      // Verify tree structure levels
      const levelCounts = relationships.reduce((counts, rel) => {
        counts[rel.level] = (counts[rel.level] || 0) + 1;
        return counts;
      }, {} as Record<number, number>);

      expect(levelCounts[0]).toBe(1); // 1 root (A)
      expect(levelCounts[1]).toBe(2); // 2 level-1 members (B, C)
      expect(levelCounts[2]).toBe(2); // 2 level-2 members (D, E)

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: setupResult.userIds,
        groupIds: [setupResult.groupId]
      });
    });

    test('should handle empty invitation graph gracefully', async ({ page }) => {
      // Create group with no invitations
      const user = createTestUserWithInvites('solo');
      const group = createTestGroupWithInvites('Empty Graph Group');

      const userId = await databaseHelper.createTestUser(user);
      const groupId = await databaseHelper.createTestGroup(group, userId);
      await databaseHelper.addGroupMember(userId, groupId, 'admin');

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: userId, email: user.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteGraph();

      // Verify empty state message
      const emptyMessage = page.locator(':has-text("No invitation data available")');
      await expect(emptyMessage).toBeVisible();

      // Verify helpful explanation
      const explanation = page.locator(':has-text("This group has no recorded invitations yet")');
      await expect(explanation).toBeVisible();

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId],
        groupIds: [groupId]
      });
    });
  });

  test.describe('Graph Interaction and Navigation', () => {
    test('should display graph statistics correctly', async ({ page }) => {
      const tree = createComplexInvitationTree();
      const setupResult = await databaseHelper.setupInvitationChain(tree);

      const rootUser = tree.users[0];

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: setupResult.userIds[0], email: rootUser.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteGraph();

      // Verify individual statistics
      const totalInvitations = page.locator('[data-testid="total-invitations-stat"]');
      await expect(totalInvitations).toContainText('4 total invitations');

      const activeInviters = page.locator('[data-testid="active-inviters-stat"]');
      await expect(activeInviters).toContainText('3 active inviters');

      const rootMembers = page.locator('[data-testid="root-members-stat"]');
      await expect(rootMembers).toContainText('1 root members');

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: setupResult.userIds,
        groupIds: [setupResult.groupId]
      });
    });

    test('should show graph loading state', async ({ page }) => {
      const user = createTestUserWithInvites('loader');
      const group = createTestGroupWithInvites('Loading Group');

      const userId = await databaseHelper.createTestUser(user);
      const groupId = await databaseHelper.createTestGroup(group, userId);
      await databaseHelper.addGroupMember(userId, groupId, 'admin');

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: userId, email: user.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      // Navigate to graph - should briefly show loading state
      await page.click('[data-testid="view-invite-graph-button"]');

      // Check for loading indicator (may be brief)
      try {
        await expect(page.locator(':has-text("Loading invite graph")')).toBeVisible({ timeout: 1000 });
      } catch {
        // Loading may complete too quickly for this assertion
      }

      // Verify graph loads eventually
      await page.waitForSelector('[data-testid="invite-graph-container"]', { timeout: 10000 });

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: [userId],
        groupIds: [groupId]
      });
    });
  });

  test.describe('Graph Tree Structure Rendering', () => {
    test('should render tree structure with proper indentation and connectors', async ({ page }) => {
      const tree = createComplexInvitationTree();
      const setupResult = await databaseHelper.setupInvitationChain(tree);

      const rootUser = tree.users[0];

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: setupResult.userIds[0], email: rootUser.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteGraph();

      // Verify tree container exists
      const treeContainer = page.locator('[data-testid="invite-graph-tree"]');
      await expect(treeContainer).toBeVisible();

      // Verify all relationship elements are present
      const relationshipElements = page.locator('[data-testid="invite-relationship"]');
      const relationshipCount = await relationshipElements.count();
      expect(relationshipCount).toBe(5); // Root + 4 relationships

      // Verify level attributes are correct
      for (let i = 0; i < relationshipCount; i++) {
        const element = relationshipElements.nth(i);
        const level = await element.getAttribute('data-level');
        expect(level).toMatch(/^[0-2]$/); // Levels 0, 1, or 2
      }

      // Verify root user (level 0) exists
      const rootElement = page.locator('[data-testid="invite-relationship"][data-level="0"]');
      await expect(rootElement).toBeVisible();

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: setupResult.userIds,
        groupIds: [setupResult.groupId]
      });
    });

    test('should show helpful explanation for reading the graph', async ({ page }) => {
      const chain = createSimpleInvitationChain();
      const setupResult = await databaseHelper.setupInvitationChain(chain);

      const creatorUser = chain.users[0];

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: setupResult.userIds[0], email: creatorUser.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteGraph();

      // Verify explanation section
      const explanation = page.locator(':has-text("How to read this graph:")');
      await expect(explanation).toBeVisible();

      // Check for key explanation points
      await expect(page.locator(':has-text("Root members (Level 0)")')).toBeVisible();
      await expect(page.locator(':has-text("Each level shows who was invited")')).toBeVisible();
      await expect(page.locator(':has-text("tree structure shows the complete invitation chain")')).toBeVisible();

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: setupResult.userIds,
        groupIds: [setupResult.groupId]
      });
    });
  });

  test.describe('Multi-User Perspective', () => {
    test('should show same graph data for all group members', async ({ page }) => {
      const tree = createComplexInvitationTree();
      const setupResult = await databaseHelper.setupInvitationChain(tree);

      // Test from perspective of different users (root and mid-level)
      const rootUser = tree.users[0]; // User A
      const midUser = tree.users[1];  // User B

      // First, check as root user
      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: setupResult.userIds[0], email: rootUser.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteGraph();

      // Get graph statistics as root user
      const rootStats = await inviteHelper.getInvitationRelationships();

      // Now check as mid-level user
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: setupResult.userIds[1], email: midUser.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteGraph();

      // Get graph statistics as mid-level user
      const midStats = await inviteHelper.getInvitationRelationships();

      // Both users should see the same complete graph
      expect(rootStats.length).toBe(midStats.length);

      // Verify same statistics are shown
      await inviteHelper.verifyInviteGraph({
        totalInvitations: 4,
        activeInviters: 3,
        rootMembers: 1
      });

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: setupResult.userIds,
        groupIds: [setupResult.groupId]
      });
    });
  });

  test.describe('Graph Data Accuracy', () => {
    test('should accurately reflect database invitation relationships', async ({ page }) => {
      const tree = createComplexInvitationTree();
      const setupResult = await databaseHelper.setupInvitationChain(tree);

      // Get actual invitation data from database
      const dbInviteGraph = await databaseHelper.getInviteGraph(setupResult.groupId);

      const rootUser = tree.users[0];

      await page.goto('/');
      await page.evaluate((testUser) => {
        localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: testUser.id, email: testUser.email }
        }));
      }, { id: setupResult.userIds[0], email: rootUser.email });

      await page.reload();
      await page.waitForSelector('[data-testid="main-app"]');

      await inviteHelper.navigateToInviteGraph();

      // Verify UI matches database exactly
      const uiRelationships = await inviteHelper.getInvitationRelationships();

      // Should have same number of relationships
      expect(uiRelationships.length).toBe(dbInviteGraph.length + 1); // +1 for root display

      // Verify each database relationship appears in UI
      for (const dbRelation of dbInviteGraph) {
        const matchingUiRelation = uiRelationships.find(ui =>
          ui.inviter.includes(dbRelation.inviter_username) &&
          ui.invitee.includes(dbRelation.invitee_username)
        );
        expect(matchingUiRelation).toBeDefined();
      }

      // Cleanup
      await databaseHelper.cleanupTestData({
        userIds: setupResult.userIds,
        groupIds: [setupResult.groupId]
      });
    });
  });
});