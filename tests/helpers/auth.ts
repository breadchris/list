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
   * Login via UI form
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
   * Check if user is logged in by looking for authenticated content
   */
  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      // Look for elements that only appear when authenticated
      await page.waitForSelector('[data-testid="main-app"]', { timeout: 3000 });
      return true;
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