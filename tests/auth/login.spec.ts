import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth';
import { createTestUser, generateTestEmail, generateTestPassword } from '../helpers/test-data';

// Initialize auth helper
let authHelper: AuthHelper;

test.beforeEach(async () => {
  authHelper = new AuthHelper();
});

test.describe('User Authentication', () => {
  test.describe('Login Flow', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      // Create a test user first
      const testUser = createTestUser('login-test');
      await authHelper.createTestUser(testUser.email, testUser.password);

      try {
        // Navigate to home page
        await page.goto('/');

        // Wait for the auth form to appear
        await page.waitForSelector('form', { timeout: 10000 });

        // Make sure we're on the login form (default state)
        const signInButton = page.locator('button[type="submit"]:has-text("Sign in")');
        await expect(signInButton).toBeVisible();

        // Fill in credentials
        await page.fill('input[name="email"]', testUser.email);
        await page.fill('input[name="password"]', testUser.password);

        // Submit the form
        await page.click('button[type="submit"]');

        // Wait for successful login - the auth form should disappear
        await page.waitForSelector('form', { state: 'hidden', timeout: 10000 });

        // Verify we're logged in by checking that auth form is gone
        await expect(page.locator('h2:has-text("Sign in to your account")')).not.toBeVisible();

        // Should be able to see some form of main application
        const url = page.url();
        expect(url).not.toContain('/login');
      } finally {
        // Clean up test user
        await authHelper.deleteTestUser(testUser.email);
      }
    });

    test('should show error with invalid credentials', async ({ page }) => {
      // Navigate to home page
      await page.goto('/');

      // Wait for the auth form
      await page.waitForSelector('form', { timeout: 10000 });

      // Try to login with invalid credentials
      await page.fill('input[name="email"]', 'nonexistent@test.com');
      await page.fill('input[name="password"]', 'wrongpassword');

      // Submit the form
      await page.click('button[type="submit"]');

      // Should see an error message
      await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.bg-red-50')).toContainText(/invalid/i);
    });

    test('should show validation error for empty fields', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('form', { timeout: 10000 });

      // Try to submit empty form
      await page.click('button[type="submit"]');

      // Form validation should prevent submission
      const emailInput = page.locator('input[name="email"]');
      await expect(emailInput).toHaveAttribute('required');

      const passwordInput = page.locator('input[name="password"]');
      await expect(passwordInput).toHaveAttribute('required');
    });
  });

  test.describe('Signup Flow', () => {
    test('should successfully sign up new user', async ({ page }) => {
      const testUser = createTestUser('signup-test');

      try {
        await page.goto('/');
        await page.waitForSelector('form', { timeout: 10000 });

        // Switch to signup mode
        await page.click('button:has-text("Don\'t have an account? Sign up")');

        // Verify we're in signup mode
        await expect(page.locator('h2')).toContainText('Create new account');

        // Fill in signup form
        await page.fill('input[name="email"]', testUser.email);
        await page.fill('input[name="password"]', testUser.password);

        // Submit signup form
        await page.click('button[type="submit"]');

        // Should see either:
        // 1. Email confirmation message (if confirmations enabled)
        // 2. Immediate login (if confirmations disabled in test env)

        const hasConfirmationMessage = await page.locator(':has-text("check your email")').isVisible({ timeout: 3000 }).catch(() => false);
        const hasMainApp = await page.locator('h2:has-text("Sign in to your account")').isHidden({ timeout: 3000 }).catch(() => false);

        expect(hasConfirmationMessage || hasMainApp).toBeTruthy();

        if (hasConfirmationMessage) {
          await expect(page.locator(':has-text("check your email")')).toBeVisible();
          await expect(page.locator(':has-text("confirmation link")')).toBeVisible();
        }
      } finally {
        // Clean up test user
        await authHelper.deleteTestUser(testUser.email);
      }
    });

    test('should show error for duplicate email signup', async ({ page }) => {
      const testUser = createTestUser('duplicate-test');

      // Create the user first
      await authHelper.createTestUser(testUser.email, testUser.password);

      try {
        await page.goto('/');
        await page.waitForSelector('form', { timeout: 10000 });

        // Switch to signup mode
        await page.click('button:has-text("Don\'t have an account? Sign up")');

        // Try to sign up with existing email
        await page.fill('input[name="email"]', testUser.email);
        await page.fill('input[name="password"]', 'DifferentPassword123!');

        await page.click('button[type="submit"]');

        // Should see error about user already existing
        await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });
      } finally {
        await authHelper.deleteTestUser(testUser.email);
      }
    });

    test('should enforce password minimum length', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('form', { timeout: 10000 });

      // Switch to signup mode
      await page.click('button:has-text("Don\'t have an account? Sign up")');

      // Try signup with short password
      await page.fill('input[name="email"]', generateTestEmail('short-pass'));
      await page.fill('input[name="password"]', '123'); // Too short

      // Password field should have minLength attribute
      const passwordInput = page.locator('input[name="password"]');
      await expect(passwordInput).toHaveAttribute('minLength', '6');
    });
  });

  test.describe('Form Toggle', () => {
    test('should switch between login and signup forms', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('form', { timeout: 10000 });

      // Should start with login form
      await expect(page.locator('h2')).toContainText('Sign in to your account');
      await expect(page.locator('button[type="submit"]')).toContainText('Sign in');

      // Switch to signup
      await page.click('button:has-text("Don\'t have an account? Sign up")');
      await expect(page.locator('h2')).toContainText('Create new account');
      await expect(page.locator('button[type="submit"]')).toContainText('Sign up');

      // Switch back to login
      await page.click('button:has-text("Already have an account? Sign in")');
      await expect(page.locator('h2')).toContainText('Sign in to your account');
      await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain login state across page reloads', async ({ page }) => {
      const testUser = createTestUser('session-test');
      await authHelper.createTestUser(testUser.email, testUser.password);

      try {
        // Login
        await page.goto('/');
        await page.waitForSelector('form', { timeout: 10000 });
        await page.fill('input[name="email"]', testUser.email);
        await page.fill('input[name="password"]', testUser.password);
        await page.click('button[type="submit"]');

        // Wait for login success
        await page.waitForSelector('form', { state: 'hidden', timeout: 10000 });

        // Reload the page
        await page.reload();

        // Should still be logged in (not see auth form)
        await page.waitForSelector('form', { state: 'hidden', timeout: 10000 });
        const hasAuthForm = await page.locator('form input[name="email"]').isVisible({ timeout: 3000 }).catch(() => false);
        expect(hasAuthForm).toBeFalsy();
      } finally {
        await authHelper.deleteTestUser(testUser.email);
      }
    });
  });

  test.describe('Loading States', () => {
    test('should show loading state during login', async ({ page }) => {
      const testUser = createTestUser('loading-test');
      await authHelper.createTestUser(testUser.email, testUser.password);

      try {
        await page.goto('/');
        await page.waitForSelector('form', { timeout: 10000 });

        await page.fill('input[name="email"]', testUser.email);
        await page.fill('input[name="password"]', testUser.password);

        // Click submit and immediately check for loading state
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();

        // Button should be disabled and show loading text
        await expect(submitButton).toBeDisabled();

        // Should eventually complete and hide auth form
        await page.waitForSelector('form', { state: 'hidden', timeout: 10000 });
      } finally {
        await authHelper.deleteTestUser(testUser.email);
      }
    });
  });

  test.describe('Google OAuth', () => {
    test('should show Google sign-in button', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('form', { timeout: 10000 });

      // Should see Google sign-in button
      const googleButton = page.locator('button:has-text("Sign in with Google")');
      await expect(googleButton).toBeVisible();

      // Should have Google logo/icon
      await expect(googleButton.locator('svg')).toBeVisible();
    });

    // Note: Testing actual OAuth flow would require special setup
    // and is typically mocked in E2E tests or tested manually
  });
});