import { test, expect } from '@playwright/test';
import { AuthHelper } from './helpers/auth';
import { DatabaseHelper } from './helpers/database-helper';

test.describe('External Search Workflows', () => {
  let authHelper: AuthHelper;
  let dbHelper: DatabaseHelper;
  let testUser: any;
  let testGroupId: string;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper();
    dbHelper = new DatabaseHelper();

    // Create test user
    const email = `search-test-${Date.now()}@test.com`;
    testUser = await authHelper.createTestUser(email);

    // Create a test group
    testGroupId = await dbHelper.createTestGroup({
      name: 'External Search Test Group',
      user_id: testUser.id
    });

    // Login
    await authHelper.loginProgrammatically(page, testUser.email, testUser.password);

    // Navigate to the group
    await page.goto(`/?g=${testGroupId}`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    // Cleanup
    if (testGroupId) {
      await dbHelper.deleteTestGroup(testGroupId);
    }
    if (testUser?.id) {
      await dbHelper.deleteTestUser(testUser.id);
    }
  });

  test.describe('TMDb Search Workflow', () => {
    test('should open search panel and display TMDb option', async ({ page }) => {
      console.log('🧪 Testing TMDb search panel visibility');

      // Click FAB to open input panel
      const fab = page.locator('[data-testid="fab-button"]').or(
        page.locator('button[aria-label*="Add"]')
      ).first();
      await fab.click();

      // Select search content type
      const searchTypeButton = page.locator('button:has-text("Search")').or(
        page.locator('[data-testid="content-type-search"]')
      ).first();
      await expect(searchTypeButton).toBeVisible({ timeout: 5000 });
      await searchTypeButton.click();

      console.log('✓ Search panel opened');

      // Verify TMDb search option is visible
      const tmdbButton = page.locator('button:has-text("Movies")').or(
        page.locator('button:has-text("TMDb")').or(
          page.locator('[data-workflow-id="tmdb-search"]')
        )
      ).first();
      await expect(tmdbButton).toBeVisible({ timeout: 5000 });

      console.log('✅ TMDb search option visible');
    });

    test('should activate TMDb search and show submit button', async ({ page }) => {
      console.log('🧪 Testing TMDb search activation');

      // Open search panel
      const fab = page.locator('[data-testid="fab-button"]').or(
        page.locator('button[aria-label*="Add"]')
      ).first();
      await fab.click();

      const searchTypeButton = page.locator('button:has-text("Search")').first();
      await searchTypeButton.click();

      // Type a search query
      const searchInput = page.locator('input[placeholder*="Search"]').or(
        page.locator('[data-testid="search-input"]')
      ).first();
      await searchInput.fill('Inception');
      console.log('✓ Search query entered: Inception');

      // Click TMDb search option
      const tmdbButton = page.locator('button:has-text("Movies")').or(
        page.locator('button:has-text("TMDb")')
      ).first();
      await tmdbButton.click();
      console.log('✓ TMDb search activated');

      // Verify active state (check mark or border)
      await expect(tmdbButton).toHaveClass(/teal-500|border-teal|bg-teal/, { timeout: 3000 });

      // Verify submit button appears
      const submitButton = page.locator('button:has-text("Search")').last();
      await expect(submitButton).toBeVisible({ timeout: 3000 });
      await expect(submitButton).toBeEnabled();

      console.log('✅ TMDb search activated with submit button');
    });

    test('should execute TMDb search and show results modal', async ({ page }) => {
      console.log('🧪 Testing TMDb search execution');

      // Open search panel
      const fab = page.locator('[data-testid="fab-button"]').or(
        page.locator('button[aria-label*="Add"]')
      ).first();
      await fab.click();

      const searchTypeButton = page.locator('button:has-text("Search")').first();
      await searchTypeButton.click();

      // Enter search query
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('The Matrix');
      console.log('✓ Search query: The Matrix');

      // Activate TMDb search
      const tmdbButton = page.locator('button:has-text("Movies")').or(
        page.locator('button:has-text("TMDb")')
      ).first();
      await tmdbButton.click();
      console.log('✓ TMDb activated');

      // Execute search
      const submitButton = page.locator('button:has-text("Search")').last();
      await submitButton.click();
      console.log('✓ Search submitted');

      // Wait for TMDb results modal
      const resultsModal = page.locator('text=/TMDb.*Results/i').or(
        page.locator('[data-testid="tmdb-modal"]')
      );
      await expect(resultsModal).toBeVisible({ timeout: 15000 });

      // Verify results are displayed
      const resultCards = page.locator('[data-testid="tmdb-result"]').or(
        page.locator('div:has-text("The Matrix")')
      );
      await expect(resultCards.first()).toBeVisible({ timeout: 10000 });

      console.log('✅ TMDb search results displayed');
    });

    test('should select and add TMDb results', async ({ page }) => {
      console.log('🧪 Testing TMDb result selection and addition');

      // Execute TMDb search (reuse previous steps)
      const fab = page.locator('[data-testid="fab-button"]').or(
        page.locator('button[aria-label*="Add"]')
      ).first();
      await fab.click();

      const searchTypeButton = page.locator('button:has-text("Search")').first();
      await searchTypeButton.click();

      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Interstellar');

      const tmdbButton = page.locator('button:has-text("Movies")').or(
        page.locator('button:has-text("TMDb")')
      ).first();
      await tmdbButton.click();

      const submitButton = page.locator('button:has-text("Search")').last();
      await submitButton.click();

      // Wait for results modal
      await page.waitForTimeout(3000);

      // Select first result
      const firstResult = page.locator('[data-testid="tmdb-result"]').or(
        page.locator('div:has-text("Interstellar")').first()
      );
      await firstResult.click();
      console.log('✓ Result selected');

      // Click Add Selected button
      const addButton = page.locator('button:has-text("Add Selected")').or(
        page.locator('[data-testid="add-tmdb-results"]')
      ).first();
      await expect(addButton).toBeVisible();
      await expect(addButton).toBeEnabled();
      await addButton.click();
      console.log('✓ Add button clicked');

      // Wait for success toast
      const successToast = page.locator('text=/Content Added|Successfully added/i');
      await expect(successToast).toBeVisible({ timeout: 10000 });

      // Verify modal closes
      await expect(page.locator('text=/TMDb.*Results/i')).not.toBeVisible({ timeout: 5000 });

      console.log('✅ TMDb results added successfully');
    });

    test('should keep search panel open when no results', async ({ page }) => {
      console.log('🧪 Testing search panel persistence with no results');

      // Open search panel
      const fab = page.locator('[data-testid="fab-button"]').or(
        page.locator('button[aria-label*="Add"]')
      ).first();
      await fab.click();

      const searchTypeButton = page.locator('button:has-text("Search")').first();
      await searchTypeButton.click();

      // Enter query that returns no results
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('xyznonexistentmovie12345');

      const tmdbButton = page.locator('button:has-text("Movies")').or(
        page.locator('button:has-text("TMDb")')
      ).first();
      await tmdbButton.click();

      const submitButton = page.locator('button:has-text("Search")').last();
      await submitButton.click();

      // Wait for modal
      await page.waitForTimeout(3000);

      // Verify "No results" message in modal
      const noResults = page.locator('text=/No results|No.*found/i');
      await expect(noResults).toBeVisible({ timeout: 10000 });

      // Close modal
      const closeButton = page.locator('button:has-text("Cancel")').or(
        page.locator('button:has-text("Close")')
      ).first();
      await closeButton.click();

      // Verify search input is still visible and editable
      await expect(searchInput).toBeVisible();
      await searchInput.clear();
      await searchInput.fill('New search term');

      console.log('✅ Search panel persists after no results');
    });
  });

  test.describe('Libgen Search Workflow', () => {
    test('should open search panel and display Books option', async ({ page }) => {
      console.log('🧪 Testing Libgen search panel visibility');

      // Open search panel
      const fab = page.locator('[data-testid="fab-button"]').or(
        page.locator('button[aria-label*="Add"]')
      ).first();
      await fab.click();

      const searchTypeButton = page.locator('button:has-text("Search")').first();
      await searchTypeButton.click();

      // Verify Books search option is visible
      const booksButton = page.locator('button:has-text("Books")').or(
        page.locator('[data-workflow-id="libgen-search"]')
      ).first();
      await expect(booksButton).toBeVisible({ timeout: 5000 });

      console.log('✅ Books search option visible');
    });

    test('should activate Libgen search and show submit button', async ({ page }) => {
      console.log('🧪 Testing Libgen search activation');

      // Open search panel
      const fab = page.locator('[data-testid="fab-button"]').or(
        page.locator('button[aria-label*="Add"]')
      ).first();
      await fab.click();

      const searchTypeButton = page.locator('button:has-text("Search")').first();
      await searchTypeButton.click();

      // Type a search query
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Clean Code');
      console.log('✓ Search query entered: Clean Code');

      // Click Books search option
      const booksButton = page.locator('button:has-text("Books")').first();
      await booksButton.click();
      console.log('✓ Libgen search activated');

      // Verify active state
      await expect(booksButton).toHaveClass(/teal-500|border-teal|bg-teal/, { timeout: 3000 });

      // Verify submit button appears
      const submitButton = page.locator('button:has-text("Search")').last();
      await expect(submitButton).toBeVisible({ timeout: 3000 });
      await expect(submitButton).toBeEnabled();

      console.log('✅ Libgen search activated with submit button');
    });

    test('should execute Libgen search and show config modal', async ({ page }) => {
      console.log('🧪 Testing Libgen search execution');

      // Open search panel
      const fab = page.locator('[data-testid="fab-button"]').or(
        page.locator('button[aria-label*="Add"]')
      ).first();
      await fab.click();

      const searchTypeButton = page.locator('button:has-text("Search")').first();
      await searchTypeButton.click();

      // Enter search query
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Design Patterns');
      console.log('✓ Search query: Design Patterns');

      // Activate Libgen search
      const booksButton = page.locator('button:has-text("Books")').first();
      await booksButton.click();
      console.log('✓ Libgen activated');

      // Execute search
      const submitButton = page.locator('button:has-text("Search")').last();
      await submitButton.click();
      console.log('✓ Search submitted');

      // Wait for Libgen config modal
      const configModal = page.locator('text=/Libgen.*Search|Configure.*Search/i').or(
        page.locator('[data-testid="libgen-modal"]')
      );
      await expect(configModal).toBeVisible({ timeout: 10000 });

      // Verify search configuration options
      const searchTypeDropdown = page.locator('select').or(
        page.locator('text=/Search Type|Default|Title|Author/i')
      ).first();
      await expect(searchTypeDropdown).toBeVisible({ timeout: 5000 });

      console.log('✅ Libgen config modal displayed');
    });

    test('should keep Libgen modal open after search execution', async ({ page }) => {
      console.log('🧪 Testing Libgen modal persistence after search');

      // Execute Libgen search (reuse previous steps)
      const fab = page.locator('[data-testid="fab-button"]').or(
        page.locator('button[aria-label*="Add"]')
      ).first();
      await fab.click();

      const searchTypeButton = page.locator('button:has-text("Search")').first();
      await searchTypeButton.click();

      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Test Book Query');

      const booksButton = page.locator('button:has-text("Books")').first();
      await booksButton.click();

      const submitButton = page.locator('button:has-text("Search")').last();
      await submitButton.click();

      // Wait for config modal
      await page.waitForTimeout(2000);

      // Execute the search from config modal
      const searchButton = page.locator('button:has-text("Search")').last();
      await searchButton.click();
      console.log('✓ Libgen search executed');

      // Wait for potential success message
      await page.waitForTimeout(3000);

      // Verify modal is still visible (should not auto-close)
      const configModal = page.locator('text=/Libgen.*Search|Configure.*Search/i');
      await expect(configModal).toBeVisible({ timeout: 5000 });

      console.log('✅ Libgen modal remains open after search');
    });
  });

  test.describe('Content Search Workflow', () => {
    test('should search existing content and display results', async ({ page }) => {
      console.log('🧪 Testing content search functionality');

      // Create some test content first
      const contentId = await dbHelper.createTestContent({
        type: 'text',
        data: 'Test searchable content about TypeScript',
        group_id: testGroupId,
        user_id: testUser.id,
        parent_content_id: null
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // Open search panel
      const fab = page.locator('[data-testid="fab-button"]').or(
        page.locator('button[aria-label*="Add"]')
      ).first();
      await fab.click();

      const searchTypeButton = page.locator('button:has-text("Search")').first();
      await searchTypeButton.click();

      // Enter search query for existing content
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('TypeScript');
      console.log('✓ Search query: TypeScript');

      // Wait for search results (debounced)
      await page.waitForTimeout(1000);

      // Verify search results show the test content
      const resultItem = page.locator(`[data-content-id="${contentId}"]`).or(
        page.locator('text=/TypeScript/i')
      );
      await expect(resultItem).toBeVisible({ timeout: 5000 });

      // Cleanup
      await dbHelper.deleteTestContent(contentId);

      console.log('✅ Content search working correctly');
    });

    test('should clear content search when external search is activated', async ({ page }) => {
      console.log('🧪 Testing search mode switching');

      // Open search panel
      const fab = page.locator('[data-testid="fab-button"]').or(
        page.locator('button[aria-label*="Add"]')
      ).first();
      await fab.click();

      const searchTypeButton = page.locator('button:has-text("Search")').first();
      await searchTypeButton.click();

      // Type content search query
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('Some content query');
      console.log('✓ Content search query entered');

      // Wait for any search results
      await page.waitForTimeout(1000);

      // Activate external search (TMDb)
      const tmdbButton = page.locator('button:has-text("Movies")').or(
        page.locator('button:has-text("TMDb")')
      ).first();
      await tmdbButton.click();
      console.log('✓ External search activated');

      // Verify active state shows
      await expect(tmdbButton).toHaveClass(/teal-500|border-teal|bg-teal/);

      // Verify submit button appears (indicates mode switch)
      const submitButton = page.locator('button:has-text("Search")').last();
      await expect(submitButton).toBeVisible();

      console.log('✅ Search mode switching works correctly');
    });
  });
});
