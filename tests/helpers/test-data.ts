/**
 * Test data helpers for creating consistent test scenarios
 */

export interface TestUser {
  email: string;
  password: string;
  id?: string;
}

export interface TestGroup {
  name: string;
  join_code: string;
  id?: string;
}

/**
 * Generate unique test email addresses
 */
export function generateTestEmail(prefix: string = 'user'): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${random}@test.playwright.dev`;
}

/**
 * Generate test password
 */
export function generateTestPassword(): string {
  return 'TestPass123!';
}

/**
 * Create test user data
 */
export function createTestUser(prefix: string = 'user'): TestUser {
  return {
    email: generateTestEmail(prefix),
    password: generateTestPassword(),
  };
}

/**
 * Create test group data
 */
export function createTestGroup(name: string = 'Test Group'): TestGroup {
  const timestamp = Date.now();
  return {
    name: `${name} ${timestamp}`,
    join_code: `TEST${Math.floor(Math.random() * 1000)}`,
  };
}

/**
 * Predefined test users for consistent testing
 */
export const TEST_USERS = {
  VALID_USER: {
    email: 'valid-user@test.playwright.dev',
    password: 'ValidPass123!',
  },
  INVALID_USER: {
    email: 'invalid-user@test.playwright.dev',
    password: 'InvalidPass123!',
  },
  NEW_USER: {
    email: 'new-user@test.playwright.dev',
    password: 'NewPass123!',
  },
} as const;

/**
 * Test content for creating sample data
 */
export const TEST_CONTENT = {
  SIMPLE_TEXT: 'This is a test content item',
  MARKDOWN_TEXT: '# Test Header\n\nThis is **bold** text with [a link](https://example.com)',
  LONG_TEXT: 'This is a very long text content that should test scrolling and text wrapping in the application. '.repeat(10),
} as const;