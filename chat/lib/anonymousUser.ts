/**
 * Anonymous user utilities for managing unauthenticated file uploads
 *
 * Anonymous users get a persistent UUID stored in localStorage
 * All anonymous uploads go to a shared system group
 */

// Fixed UUID for the anonymous uploads group
export const ANONYMOUS_GROUP_ID = '00000000-0000-0000-0000-000000000001';

const ANONYMOUS_USER_KEY = 'anonymous_user_id';

/**
 * Generate a random UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get or create an anonymous user ID
 * Stores the ID in localStorage for persistence across sessions
 *
 * @returns UUID string for the anonymous user
 */
export function getOrCreateAnonymousUserId(): string {
  // Check if we already have an ID in localStorage
  const existingId = localStorage.getItem(ANONYMOUS_USER_KEY);
  if (existingId) {
    return existingId;
  }

  // Generate new ID and store it
  const newId = generateUUID();
  localStorage.setItem(ANONYMOUS_USER_KEY, newId);

  return newId;
}

/**
 * Clear the anonymous user ID from localStorage
 * Useful when user signs up and wants to start fresh
 */
export function clearAnonymousUserId(): void {
  localStorage.removeItem(ANONYMOUS_USER_KEY);
}

/**
 * Check if the current user is anonymous (not authenticated)
 *
 * @param userId - Current user ID from auth context
 * @returns true if user is anonymous
 */
export function isAnonymousUser(userId: string | null | undefined): boolean {
  if (!userId) return true;

  const anonymousId = localStorage.getItem(ANONYMOUS_USER_KEY);
  return userId === anonymousId;
}
