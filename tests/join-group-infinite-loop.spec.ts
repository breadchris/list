import { test, expect } from '@playwright/test';
import { supabase } from './helpers/supabase-test-helper';
import { TestDataGenerator } from './helpers/test-data-generator';

test.describe('Join Group Infinite Loop Prevention', () => {
  let testData: TestDataGenerator;
  let testUser: any;
  let testGroup: any;
  let inviteCode: string;
  let joinAttemptCount = 0;

  test.beforeAll(async () => {
    testData = new TestDataGenerator();

    // Create test user
    testUser = await testData.createTestUser();

    // Create test group
    testGroup = await testData.createTestGroup(testUser.id, 'Test Group for Loop');

    // Create invite code
    const { data: inviteData } = await supabase
      .from('invite_codes')
      .insert({
        group_id: testGroup.id,
        code: testData.generateRandomString(6),
        created_by: testUser.id,
        type: 'user',
        is_active: true
      })
      .select()
      .single();

    inviteCode = inviteData.code;
  });

  test.afterAll(async () => {
    await testData.cleanup();
  });

  test('should only attempt to join group once when navigating to invite URL', async ({ page }) => {
    // Track API calls to join group endpoint
    await page.route('**/rest/v1/rpc/join_group_with_user_code', async route => {
      joinAttemptCount++;

      // Simulate successful join response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: testGroup.id,
          name: testGroup.name,
          created_at: testGroup.created_at,
          created_by: testGroup.created_by
        })
      });
    });

    // Track navigation calls to ensure we don't loop
    let navigationCount = 0;
    await page.route('**/group/**', async route => {
      navigationCount++;
      await route.continue();
    });

    // Navigate to invite URL
    await page.goto(`http://localhost:8080/invite/${inviteCode}`);

    // Wait for potential multiple attempts (if bug exists)
    await page.waitForTimeout(3000);

    // Assert that join was only attempted once
    expect(joinAttemptCount).toBe(1);
    expect(joinAttemptCount).not.toBeGreaterThan(1);

    // Log for debugging
    console.log(`Join attempts: ${joinAttemptCount}`);
    console.log(`Navigation attempts: ${navigationCount}`);

    // Verify we ended up on the group page
    await expect(page).toHaveURL(new RegExp(`/group/${testGroup.id}`));
  });

  test('should not retry join when already in progress', async ({ page }) => {
    let localJoinCount = 0;

    // Simulate slow API response
    await page.route('**/rest/v1/rpc/join_group_with_user_code', async route => {
      localJoinCount++;

      // Delay response to simulate slow network
      await new Promise(resolve => setTimeout(resolve, 2000));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: testGroup.id,
          name: testGroup.name
        })
      });
    });

    // Navigate to invite URL
    await page.goto(`http://localhost:8080/invite/${inviteCode}`);

    // Try to trigger multiple renders/effects while join is in progress
    await page.evaluate(() => {
      // Force re-renders
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('focus'));
    });

    // Wait for join to complete
    await page.waitForTimeout(3000);

    // Should still only have one join attempt
    expect(localJoinCount).toBe(1);
  });

  test('should handle join failure without infinite retry', async ({ page }) => {
    let failureAttempts = 0;

    await page.route('**/rest/v1/rpc/join_group_with_user_code', async route => {
      failureAttempts++;

      // Simulate failure
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid invite code'
        })
      });
    });

    await page.goto(`http://localhost:8080/invite/INVALID`);

    // Wait to see if it retries
    await page.waitForTimeout(2000);

    // Should only try once
    expect(failureAttempts).toBe(1);

    // Should show error message
    await expect(page.locator('text=/invalid|expired/i')).toBeVisible();
  });

  test('should handle "already a member" response correctly', async ({ page }) => {
    let alreadyMemberCount = 0;

    await page.route('**/rest/v1/rpc/join_group_with_user_code', async route => {
      alreadyMemberCount++;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: testGroup.id,
          name: testGroup.name,
          alreadyMember: true
        })
      });
    });

    await page.goto(`http://localhost:8080/invite/${inviteCode}`);

    await page.waitForTimeout(2000);

    // Should only check once
    expect(alreadyMemberCount).toBe(1);

    // Should navigate to group
    await expect(page).toHaveURL(new RegExp(`/group/${testGroup.id}`));
  });
});