import { Page, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Local Supabase configuration for tests
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export interface TestUser {
  email: string;
  password: string;
  id?: string;
}

export class AuthHelper {
  private supabase;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  /**
   * Create a test user in the database
   */
  async createTestUser(email: string, password: string = 'testpass123'): Promise<TestUser> {
    // Sign up the user
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(`Failed to create test user: ${error.message}`);
    }

    return {
      email,
      password,
      id: data.user?.id,
    };
  }

  /**
   * Delete a test user from the database
   */
  async deleteTestUser(email: string): Promise<void> {
    try {
      // For testing purposes, we'll just sign out any current session
      // In a local environment, test users can be cleaned up manually if needed
      await this.supabase.auth.signOut();
      console.log(`Test user cleanup attempted for ${email}`);
    } catch (error) {
      console.warn(`Error during user cleanup for ${email}:`, error);
    }
  }

  /**
   * Login via form-based authentication (recommended for tests)
   */
  async loginProgrammatically(page: Page, email: string, password: string): Promise<void> {
    console.log(`🔐 Attempting login for: ${email}`);

    // Navigate to the home page first
    await page.goto('/');

    // Wait for the authentication form to be visible
    await page.waitForSelector('text="Sign in to your account"', { timeout: 10000 });
    console.log('📋 Auth form visible');

    // Click on "Continue with email" to reveal the email/password form
    const emailButton = page.locator('button:has-text("Continue with email")');
    if (await emailButton.isVisible()) {
      console.log('📧 Clicking "Continue with email"');
      await emailButton.click();

      // Wait for the email form to be fully rendered with specific IDs
      await page.waitForSelector('#email', { timeout: 10000 });
      await page.waitForSelector('#password', { timeout: 5000 });
      console.log('📝 Email form revealed with proper elements');
    }

    // Ensure we're on the login tab (in case there are sign in/sign up tabs)
    const loginTab = page.locator('button:has-text("Already have an account? Sign in")');
    if (await loginTab.isVisible()) {
      console.log('🔄 Switching to Sign In tab');
      await loginTab.click();
      // Wait for any state change
      await page.waitForTimeout(500);
    }

    // Verify form is ready for interaction
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');

    // Wait for elements to be enabled and visible
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });

    // Verify elements are enabled
    const emailEnabled = await emailInput.isEnabled();
    const passwordEnabled = await passwordInput.isEnabled();

    if (!emailEnabled || !passwordEnabled) {
      throw new Error(`Form inputs not enabled: email=${emailEnabled}, password=${passwordEnabled}`);
    }

    console.log('✅ Form inputs are ready and enabled');

    // Fill in the email field using specific ID
    await emailInput.fill(email);
    console.log(`✉️ Email filled: ${email}`);

    // Fill in the password field using specific ID
    await passwordInput.fill(password);
    console.log('🔑 Password filled');

    // Submit the form using the exact button text and type
    const submitButton = page.locator('button[type="submit"]:has-text("Sign in")');
    await submitButton.waitFor({ state: 'visible', timeout: 5000 });

    const submitEnabled = await submitButton.isEnabled();
    if (!submitEnabled) {
      throw new Error('Submit button is not enabled');
    }

    await submitButton.click();
    console.log('🚀 Form submitted');

    // Wait for form submission to complete (look for loading state first)
    console.log('⏳ Waiting for form submission to process...');
    await page.waitForTimeout(2000); // Allow form submission to process

    // Wait for authentication to complete - auth form should disappear
    try {
      await page.waitForSelector('text="Sign in to your account"', { state: 'hidden', timeout: 20000 });
      console.log('✅ Authentication completed - auth form disappeared');
    } catch (error) {
      console.error('❌ Auth form did not disappear after login');

      // Take screenshot before checking error details
      const timestamp = Date.now();
      await page.screenshot({ path: `./data/auth-failure-${timestamp}.png` });
      console.error(`📸 Debug screenshot saved to ./data/auth-failure-${timestamp}.png`);

      // Check for error messages on the form - use more specific selectors
      let errorMessage = null;

      try {
        const errorElement = page.locator('.bg-red-50, .text-red-700, .border-red-200, [role="alert"]');
        if (await errorElement.isVisible()) {
          errorMessage = await errorElement.textContent();
        }
      } catch (e) {
        console.warn('Could not check for error message:', e);
      }

      if (errorMessage && errorMessage.trim()) {
        console.error(`🚨 Error message found: ${errorMessage.trim()}`);
        throw new Error(`Authentication failed: ${errorMessage.trim()}`);
      }

      // Check if form is still in loading state
      const loadingButton = page.locator('button:has-text("Please wait...")');
      if (await loadingButton.isVisible()) {
        console.log('🔄 Form still in loading state, waiting longer...');
        await page.waitForTimeout(5000);

        // Try waiting for auth form to disappear again
        try {
          await page.waitForSelector('text="Sign in to your account"', { state: 'hidden', timeout: 10000 });
          console.log('✅ Authentication completed after extended wait');
        } catch (e) {
          throw new Error('Authentication timed out - form still loading');
        }
      } else {
        // Check current page state for debugging
        const currentUrl = page.url();
        const pageContent = await page.content();
        console.error(`📄 Current URL: ${currentUrl}`);
        console.error(`📄 Page title: ${await page.title()}`);

        throw new Error('Authentication did not complete properly - no error message found');
      }
    }

    // Additional verification - ensure we're in authenticated state
    await page.waitForTimeout(2000); // Longer delay for auth state to stabilize
    console.log('🎉 Authentication process completed');
  }

  /**
   * Login via UI form (fallback method)
   */
  async loginViaUI(page: Page, email: string, password: string): Promise<void> {
    // Navigate to the home page which should show the auth form
    await page.goto('/');

    // Wait for the auth form to be visible
    await page.waitForSelector('[data-testid="auth-form"]', { timeout: 10000 });

    // Ensure we're on the login tab
    const loginTab = page.locator('button:has-text("Sign In")');
    if (await loginTab.isVisible()) {
      await loginTab.click();
    }

    // Fill in the login form
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);

    // Submit the form
    await page.click('[data-testid="submit-button"]');

    // Wait for successful login - the auth form should disappear
    await page.waitForSelector('[data-testid="auth-form"]', { state: 'hidden', timeout: 10000 });
  }

  /**
   * Sign up via UI form
   */
  async signupViaUI(page: Page, email: string, password: string): Promise<void> {
    // Navigate to the home page
    await page.goto('/');

    // Wait for the auth form to be visible
    await page.waitForSelector('[data-testid="auth-form"]', { timeout: 10000 });

    // Switch to signup tab
    const signupTab = page.locator('button:has-text("Sign Up")');
    await signupTab.click();

    // Fill in the signup form
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);

    // Submit the form
    await page.click('[data-testid="submit-button"]');

    // For signup, we might see a confirmation message or be logged in
    // Wait for either the auth form to disappear (auto-login) or confirmation message
    await Promise.race([
      page.waitForSelector('[data-testid="auth-form"]', { state: 'hidden', timeout: 10000 }),
      page.waitForSelector(':has-text("check your email")', { timeout: 10000 })
    ]);
  }

  /**
   * Logout via UI
   */
  async logoutViaUI(page: Page): Promise<void> {
    // Look for a logout button in the sidebar or main area
    await page.click('[data-testid="user-menu-button"]');
    await page.click('[data-testid="logout-button"]');

    // Wait for the auth form to reappear
    await page.waitForSelector('[data-testid="auth-form"]', { timeout: 10000 });
  }

  /**
   * Check if user is logged in by looking for absence of auth form
   */
  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      // Check if auth form is NOT visible (more reliable indicator)
      const authFormVisible = await page.locator('text="Sign in to your account"').isVisible();

      if (authFormVisible) {
        return false;
      }

      // Additionally check for authenticated UI elements
      const sidebarToggle = await page.locator('[data-testid="sidebar-toggle"]').isVisible();
      return sidebarToggle;
    } catch {
      return false;
    }
  }

  /**
   * Wait for authentication state to be ready
   */
  async waitForAuthReady(page: Page): Promise<void> {
    // Wait for either the auth form or the main app to be visible
    await Promise.race([
      page.waitForSelector('[data-testid="auth-form"]', { timeout: 10000 }),
      page.waitForSelector('[data-testid="main-app"]', { timeout: 10000 })
    ]);
  }
}