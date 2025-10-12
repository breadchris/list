# Claude Code Configuration

## Development Environment

- This is a React TypeScript project with Supabase backend
- Never attempt to run tests or the development server (npm run dev, npm test, etc.)
- The project uses Tailwind CSS for styling

## Project Structure

- `/components/` - React components
- `/data/` - Test configuration files and Playwright test results
- `/supabase/` - Supabase configuration and migrations
- `/types/` - TypeScript type definitions
- `/tests/` - Playwright E2E tests

## Key Features

- Hierarchical list management with nested navigation
- Real-time collaboration using Supabase
- Group-based content sharing with invite URLs
- Infinite scrolling for content lists
- Floating Action Button (FAB) input pattern
- Hamburger sidebar navigation

## Important Notes

- All data access goes through ContentRepository class
- Uses Row Level Security (RLS) policies in Supabase
- URL-based navigation for nested content
- Real-time subscriptions for live updates

## Security Guidelines

**CRITICAL**: Never hardcode secrets or credentials in code

### Secret Management Rules
- **NEVER commit secrets to code** - API keys, tokens, passwords, credentials must NEVER be hardcoded
- **Always use environment variables** - Access secrets via `process.env`, `Deno.env.get()`, etc.
- **Document required environment variables** - List what env vars are needed and where they're used
- **Use `.env` files for local development** - But never commit them to version control
- **Remove existing hardcoded secrets immediately** - If found during code review, remove and rotate the secret

### Available Environment Variables

**Supabase Edge Functions:**
- `SUPABASE_URL` - Supabase project URL (automatically provided)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations (automatically provided)
- `OPENAI_API_KEY` - OpenAI API key for LLM operations
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID for browser rendering
- `CLOUDFLARE_API_KEY` - Cloudflare API token for browser rendering
- `TMDB_API_KEY` - The Movie Database (TMDb) API key for movie/TV search

### Examples

❌ **Bad: Hardcoded secrets**
```typescript
const CLOUDFLARE_API_KEY = 'jXm-z8tnzAE2szaxOiySohrJpwrMDrDRxZL1x5-X';
const ACCOUNT_ID = 'b61180b9a24b012aa20ab5a105c606f5';
```

✅ **Good: Environment variables**
```typescript
const cloudflareApiKey = Deno.env.get('CLOUDFLARE_API_KEY');
const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

if (!cloudflareApiKey || !accountId) {
  throw new Error('Missing required environment variables');
}
```

## Test Authentication Guidelines

**CRITICAL**: Always use form-based authentication in tests

### Authentication Approach for Tests
- **NEVER use localStorage mocking** - causes inconsistent state and test failures
- **ALWAYS use real form-based authentication** - tests actual user flow
- **Form interaction pattern**: Click "Continue with email" → Fill email/password → Submit form
- **Wait for auth completion**: Wait for "Sign in to your account" text to disappear

### Correct Test Authentication Pattern
```typescript
import { AuthHelper } from './helpers/auth';
import { createTestUserWithInvites } from './helpers/invite-test-data';

const authHelper = new AuthHelper();
const user = createTestUserWithInvites('test-user');
const userId = await databaseHelper.createTestUser(user);

// Use form-based authentication
await authHelper.loginProgrammatically(page, user.email, user.password);

// Verify authentication worked
const isAuthenticated = await authHelper.isLoggedIn(page);
if (!isAuthenticated) {
  throw new Error('Authentication failed - test cannot proceed');
}
```

### Authentication Implementation Details
- Tests use real Supabase authentication through the UI form
- Test users created in database with known passwords
- Authentication detection via auth form disappearance
- Handles social login UI (clicks "Continue with email" to reveal form)
- More reliable than programmatic authentication for UI testing

### Test Result Configuration
- Test results saved to `./data/test-results/`
- HTML reports in `./data/playwright-report/`
- Screenshots and videos captured on failure for debugging

## Testing Configuration

**CRITICAL**: Playwright test results are saved to `./data/` directory

### Test Output Configuration
- Test results: `./data/test-results/`
- HTML reports: `./data/playwright-report/`
- Screenshots and videos on failure stored in test results
- Tests run against local Supabase instance (`http://127.0.0.1:54321`)
- Frontend tests run against `http://localhost:3004`

### Running Tests
```bash
npm run test:e2e                    # Run all E2E tests
npm run test:e2e:headed            # Run with browser UI visible
npm run test:e2e:ui                # Run with Playwright UI
npm run test:e2e -- tests/specific-test.spec.ts  # Run specific test
```

### Test Data Management
- Tests use DatabaseHelper for setup and cleanup
- Test users created with unique identifiers to prevent conflicts
- All test data automatically cleaned up after test completion

### Known Issues
- **Authentication mocking broken**: localStorage approach no longer works with current Supabase version
- Tests gracefully skip when authentication fails to prevent false failures
- localStorage.setItem('supabase.auth.token', ...) doesn't authenticate users
- Investigation needed for proper Supabase v2 session format or alternative mocking approach

## Test-as-Script Pattern (LISP-Style Development)

**CRITICAL**: Go tests can serve dual purposes - validation and execution

### Philosophy

Code should evolve naturally from script to reusable function to validated test, similar to LISP REPL-driven development. Write code once, use it in multiple contexts with minimal duplication.

### Pattern Structure

1. **Shared Core Function** - Contains all business logic, accepts transaction parameter
2. **Validation Test** - Uses `defer tx.Rollback()` to validate logic without side effects
3. **Execution Test** - Commits transaction to actually execute and persist changes

### Implementation Example

**Step 1: Extract Shared Function**
```go
// imdbImport performs the IMDb data import within the provided transaction
// Caller controls transaction lifecycle (commit or rollback)
func imdbImport(tx *sql.Tx, titles []IMDbTitle, userEmail string) (*IMDbImportResult, error) {
    result := &IMDbImportResult{
        TotalTitles: len(titles),
    }

    // 1. Get or create user
    var userID string
    err := tx.QueryRow(`...`).Scan(&userID)
    if err != nil {
        return nil, err
    }

    // 2. Create group for import
    // 3. Create tags
    // 4. Insert content
    // ... all business logic here

    return result, nil
}
```

**Step 2: Validation Test (Rollback Mode)**
```go
func TestIMDbIntegration(t *testing.T) {
    t.Log("🎬 Starting IMDb Integration Test (VALIDATION MODE - ROLLBACK)...")

    // Setup database connection
    db, err := sql.Open("postgres", dbURL)
    // ... connection setup

    // Load test data
    titles, err := loadAndProcessIMDbData(20)

    // Start transaction
    tx, err := db.Begin()
    defer tx.Rollback() // ALWAYS ROLLBACK - validation only

    // Execute shared function
    result, err := imdbImport(tx, titles, "user@example.com")
    if err != nil {
        t.Fatalf("Failed to import: %v", err)
    }

    // Validate results
    var groupCount int
    err = tx.QueryRow("SELECT COUNT(*) FROM groups WHERE id = $1", result.GroupID).Scan(&groupCount)
    if groupCount != 1 {
        t.Fatalf("Expected 1 group, got %d", groupCount)
    }

    t.Log("✅ Database validation passed - all data will be rolled back")
}
```

**Step 3: Execution Test (Commit Mode)**
```go
func TestIMDbImport_Commit(t *testing.T) {
    t.Log("🎬 Starting IMDb Import (EXECUTION MODE - COMMIT)...")

    // Setup database connection
    db, err := sql.Open("postgres", dbURL)
    // ... connection setup

    // Load data
    titles, err := loadAndProcessIMDbData(20)

    // Start transaction
    tx, err := db.Begin()
    // NO defer rollback

    // Execute shared function
    result, err := imdbImport(tx, titles, "user@example.com")
    if err != nil {
        tx.Rollback()
        t.Fatalf("Failed to import: %v", err)
    }

    // Commit transaction - KEY DIFFERENCE
    if err := tx.Commit(); err != nil {
        t.Fatalf("Failed to commit: %v", err)
    }

    t.Log("✅ Transaction committed - data persisted to database")
}
```

### Benefits

- **Zero code duplication** - Business logic written once
- **Safe development** - Validate behavior before committing
- **Script flexibility** - Run commit test to actually execute operations
- **Continuous validation** - Rollback test ensures logic stays correct over time
- **REPL-like workflow** - Iterate on logic, validate instantly, commit when ready

### Code Evolution Path

1. **Initial Script** - Write throwaway code to solve immediate problem
2. **Extract Function** - Move logic to reusable function with transaction parameter
3. **Add Validation Test** - Create rollback test to verify behavior
4. **Add Execution Test** - Create commit test to run as script
5. **Iterate** - Modify shared function, validation test ensures correctness

### Key Principles

- **Transaction as abstraction** - Caller controls commit/rollback, not the function
- **Minimal duplication** - Test setup code is acceptable to duplicate, business logic is not
- **Clear naming** - Use `_Commit` suffix to indicate execution tests
- **Rollback by default** - Always use `defer tx.Rollback()` in validation tests
- **Error handling** - Rollback on error in commit tests before returning

## Go HTTP Server Guidelines

**CRITICAL**: The Go HTTP server is for serving the React app only

### Server Responsibilities
- **Serve React application** - Main purpose is to serve the frontend
- **Static file serving** - CSS, fonts, and other assets
- **Development tooling** - ESBuild integration for development
- **Component rendering** - Debug endpoints for individual components

### What NOT to Add to Go Server
- **No content APIs** - Never add endpoints like `/api/content`
- **No database operations** - All data must go directly through Supabase
- **No authentication endpoints** - Use Supabase Auth exclusively
- **No business logic** - Keep server purely for static serving

### Correct Architecture
```
iOS App ──────────────────► Supabase (direct)
React App ────────────────► Supabase (direct) 
Go Server ────► React App (serves frontend only)
```

## Database Migration Guidelines

**CRITICAL**: Always create Supabase migrations for any SQL changes

### Migration Process
1. **Never modify the database directly** - always use migrations
2. **Create migration files** in `/supabase/migrations/` with format: `YYYYMMDDHHMMSS_description.sql`
3. **Use mcp__supabase__apply_migration** to apply migrations
4. **Document all schema changes** in migration comments
5. **Test migrations** before deploying to production

### Migration Best Practices
- Include rollback instructions in comments
- Use `IF NOT EXISTS` clauses for idempotent operations
- Add proper indexes for performance
- Update TypeScript types after schema changes
- Test with existing data before applying

### Search Implementation Notes
- Full text search uses PostgreSQL's `search_vector` tsvector column
- Fuzzy search implemented with `pg_trgm` extension for trigram matching
- Search functions: `search_content()` (exact) and `fuzzy_search_content()` (fuzzy)
- Performance optimized with GIN indexes on search vectors and trigrams

## Supabase Local Development Lifecycle

**CRITICAL**: Always test migrations and schema changes locally before applying to production

### Local Development Workflow

**Prerequisites:**
- Local Supabase instance running via Docker
- Supabase CLI installed (`npx supabase`)
- Database URL configured for local instance

**Standard Development Loop:**
1. **Start local Supabase**: `npx supabase start`
2. **Create migration file**: Manual creation in `/supabase/migrations/`
3. **Test migration locally**: Apply and verify changes
4. **Iterate on migration**: Modify and retest until perfect
5. **Apply to production**: Only after local validation passes

### Migration Testing Process

**Step 1: Create Migration File**
```bash
# Format: YYYYMMDDHHMMSS_description.sql
# Example: 20251008120000_optimize_content_query.sql

# Create file in supabase/migrations/
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_your_migration_name.sql
```

**Step 2: Test Locally with Reset**
```bash
# Reset local database to clean state
npx supabase db reset

# This will:
# - Drop all tables and data
# - Reapply all migrations from scratch
# - Seed database with test data (if configured)
# - Verify migration runs without errors
```

**Step 3: Iterate on Migration**
```bash
# Edit your migration file
vim supabase/migrations/20251008120000_your_migration.sql

# Reset and retest
npx supabase db reset

# Repeat until migration is perfect
```

**Step 4: Validate Schema Changes**
```bash
# Generate TypeScript types from new schema
npx supabase gen types typescript --local > types/supabase.ts

# Check that types match expectations
# Update application code to use new schema
```

**Step 5: Apply to Production**
```bash
# Use Supabase MCP server to apply migration
# This ensures migration is tracked in migration history
# Never apply SQL directly to production database
```

### Performance Debugging Methodology

**CRITICAL**: Always test query performance as an authenticated user, not as superuser

**Why This Matters:**
- Superuser queries **bypass RLS policies** entirely
- RLS policies can add significant overhead (0-13+ seconds)
- Performance measurements without RLS are misleading

**Correct Performance Testing Pattern:**

**Step 1: Identify Slow Query**
```sql
-- Copy the slow query from application logs or PostgREST URL
-- Example: REST API query converted to SQL
SELECT *
FROM content
LEFT JOIN content_tags ON content_tags.content_id = content.id
LEFT JOIN tags ON tags.id = content_tags.tag_id
WHERE content.group_id = 'xxx'
  AND content.parent_content_id IS NULL
ORDER BY content.created_at DESC
LIMIT 20;
```

**Step 2: Measure with EXPLAIN ANALYZE**
```sql
-- Run as authenticated user context (if possible)
-- Note: May need to use actual PostgREST endpoint for RLS testing
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM content WHERE group_id = 'xxx' AND parent_content_id IS NULL;
```

**Step 3: Analyze Results**
- **Planning Time**: How long to plan query (includes RLS policy evaluation)
- **Execution Time**: How long to actually run query
- **Total Time**: Planning + Execution
- **Buffers**: Disk I/O vs cache hits
- **Rows**: How many rows filtered vs returned

**Key Metrics to Check:**
1. **Planning Time > Execution Time**: Indicates RLS or index selection overhead
2. **High buffer reads**: Missing indexes or large scans
3. **BitmapAnd operations**: Multiple indexes combined (may need composite index)
4. **Sequential Scans**: Missing indexes entirely

**Step 4: Investigate Root Causes**

```sql
-- Check RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'your_table';

-- Check existing indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'your_table';

-- Check index usage statistics
SELECT
    indexrelname,
    idx_scan as scans,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE relname = 'your_table'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check for dead tuples
SELECT
    relname,
    n_live_tup,
    n_dead_tup,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public';
```

**Step 5: Test Optimizations**

```sql
-- Test composite index without creating it
-- Use hypothetical indexes extension (if available)
-- Or create index and measure improvement

EXPLAIN (ANALYZE, BUFFERS)
-- Your query here with proposed optimizations
```

**Step 6: Compare Before/After**
- Document baseline performance metrics
- Apply optimization
- Re-run EXPLAIN ANALYZE
- Calculate improvement percentage
- Verify no regression in other queries

### RLS Policy Testing

**CRITICAL**: RLS policies must be tested with actual user authentication context

**Testing Pattern:**

**Option 1: Use Supabase MCP Server**
```sql
-- Queries through MCP automatically use service role (bypasses RLS)
-- To test RLS, create test user and use their session
```

**Option 2: Test via PostgREST API**
```bash
# Get user access token from authenticated session
curl -X GET "http://localhost:54321/rest/v1/content?select=*" \
  -H "Authorization: Bearer USER_ACCESS_TOKEN" \
  -H "apikey: SUPABASE_ANON_KEY"
```

**Option 3: Set Session Variables**
```sql
-- Manually set auth.uid() for testing
SET request.jwt.claims = '{"sub": "user-uuid-here"}';
SELECT * FROM content WHERE group_id = 'xxx';
```

**Common RLS Performance Issues:**

1. **Expensive subqueries in policies**: Use indexed lookups, avoid table scans
2. **SECURITY DEFINER functions**: May bypass indexes, scan entire tables
3. **Multiple PERMISSIVE policies**: All evaluated even if one passes (OR logic)
4. **Complex path/hierarchy checks**: Use materialized columns instead of recursive queries

### Migration Rollback Strategies

**Option 1: Manual Rollback Migration**
```sql
-- Include rollback instructions in migration comments
-- Example migration: 20251008000000_add_index.sql

-- Forward migration
CREATE INDEX idx_example ON table_name (column_name);

-- Rollback: Create separate migration file
-- 20251008000001_rollback_add_index.sql
DROP INDEX IF EXISTS idx_example;
```

**Option 2: Database Snapshot Before Migration**
```bash
# Local: Reset to previous state
npx supabase db reset

# Production: Restore from Supabase backup
# Use Supabase dashboard to restore point-in-time backup
```

**Option 3: Idempotent Migrations**
```sql
-- Always use IF EXISTS / IF NOT EXISTS
DROP INDEX IF EXISTS idx_old_name;
CREATE INDEX IF NOT EXISTS idx_new_name ON table_name (column);

-- Use transactions for multi-step migrations
BEGIN;
  -- Migration steps here
  -- If any step fails, entire migration rolls back
COMMIT;
```

### Best Practices Summary

1. **Never skip local testing** - Always `npx supabase db reset` before production
2. **Measure with RLS enabled** - Superuser measurements are misleading
3. **Document baseline metrics** - Know current performance before optimizing
4. **Test rollback procedures** - Ensure you can undo changes safely
5. **Iterate locally first** - Fix issues in development, not production
6. **Use Supabase MCP tools** - Prefer `mcp__supabase__apply_migration` over manual SQL
7. **Check migration history** - Ensure migrations are tracked and versioned
8. **Vacuum after large changes** - Dead tuples impact performance significantly

## Problem-Solving Methodology

**CRITICAL**: Prioritize simplicity over defensive programming

### Core Principle: Fix Root Causes, Don't Mask Symptoms

When encountering errors or issues, always follow this hierarchy:

1. **Identify the Root Cause** - What fundamental assumption or pattern is broken?
2. **Simplify First** - Remove complexity before adding it
3. **Use Standard Patterns** - Prefer React/library conventions over custom solutions
4. **Avoid Defensive Programming** - Don't add elaborate error handling that masks real issues

### Minimalist Implementation Bias

**CRITICAL**: Always prefer the simplest solution that solves the problem

- **Start with minimal changes** - Add the least code necessary to fix the issue
- **Question complex solutions** - If a fix requires many new components or patterns, look for simpler alternatives
- **Prefer deletions over additions** - Remove unnecessary complexity rather than working around it
- **Single responsibility fixes** - Each change should address one specific problem
- **Standard library over custom** - Use built-in browser/React features before creating custom solutions

### Examples of Good vs Bad Approaches

#### ❌ Bad: Defensive Programming
```typescript
// Complex wrapper that masks the real problem
const safeSetState = useCallback((setter) => {
  return (value) => {
    if (isMountedRef.current) {
      requestAnimationFrame(() => {
        try {
          setter(value);
        } catch (error) {
          // Elaborate error handling for symptoms
        }
      });
    }
  };
}, []);
```

#### ✅ Good: Fix Root Cause  
```typescript
// Simple, standard React patterns
const [user, setUser] = useState(null);

// Stable useEffect with proper dependencies
useEffect(() => {
  const { data: { subscription } } = auth.onStateChange(handleAuth);
  return () => subscription.unsubscribe();
}, []); // Empty deps - no recreation cycles
```

### Problem-Solving Steps

1. **Remove Complexity** - Strip away defensive code to see the real issue
2. **Check Dependencies** - Look for useEffect dependency cycles and race conditions  
3. **Separate Concerns** - Move DOM operations out of React render cycles
4. **Use React.StrictMode** - Let React catch timing issues during development
5. **Standard Patterns** - Use library conventions instead of custom solutions

### When NOT to Add Defensive Code

- **State management errors** - Fix the state flow instead of catching exceptions
- **DOM manipulation conflicts** - Separate browser APIs from React lifecycle  
- **Race conditions** - Fix the async logic instead of adding guards
- **Component lifecycle issues** - Use proper React patterns instead of mount tracking

### When Defensive Code IS Appropriate

- **External API failures** - Network requests, third-party services
- **User input validation** - Form data, file uploads
- **Browser compatibility** - Feature detection for older browsers
- **Data corruption recovery** - Database inconsistencies, corrupt local storage

Remember: If you're writing complex error handling for React state updates, you're probably solving the wrong problem.

## React Query Guidelines

**CRITICAL**: Never implement optimistic updates

### Prohibition on Optimistic Updates
- **Never use `onMutate` for optimistic updates** - causes state inconsistencies and duplicate data
- **Always use simple `onSuccess` with `invalidateQueries`** - ensures clean, consistent state
- **Let loading states handle UX** - users prefer reliable data over perceived speed
- **Optimistic updates cause hard-to-debug issues** - state corruption, duplicates, race conditions

### Correct Mutation Pattern
```typescript
export const useExampleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => await repository.performAction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relevant-key'] });
    }
  });
};
```

### Why No Optimistic Updates?
- **Data consistency** - Server is always the source of truth
- **Simpler debugging** - Predictable data flow without rollback complexity
- **Prevents race conditions** - No conflicts between optimistic and real data
- **Reliable state** - Users see accurate information, not temporary illusions
- **Easier maintenance** - Less complex code with fewer edge cases

This follows our core principle: Fix root causes (slow UX), don't mask symptoms (with optimistic updates).

## Apple OAuth Configuration

**CRITICAL**: Manual setup required in Apple Developer Console and Supabase Dashboard

### Apple Developer Console Setup (Required)

**Prerequisites:**
- Active Apple Developer Account (paid membership required)
- Access to developer.apple.com

**Steps:**
1. **Create App ID with Sign in with Apple capability**
   - Go to Certificates, Identifiers & Profiles > Identifiers
   - Create new App ID with bundle identifier (e.g., com.acme.listapp)
   - Enable "Sign in with Apple" capability

2. **Create Service ID (becomes client_id)**
   - Create Services ID with different identifier (e.g., app.com.acme.listapp)
   - **SAVE THIS ID** - this becomes your `client_id` in Supabase
   - Configure with callback URL: `https://zazsrepfnamdmibcyenx.supabase.co/auth/v1/callback`

3. **Generate Secret Key**
   - Go to Keys section, create new key
   - Enable "Sign in with Apple", link to your Service ID
   - Download the .p8 file (only chance to get it)
   - Use this to generate client_secret JWT

4. **Generate Client Secret**
   - Follow Supabase docs to create JWT using the .p8 file
   - Use online tools or custom script to generate the client_secret

### Supabase Dashboard Configuration

1. **Enable Apple OAuth Provider**
   - Go to Authentication > Providers > Apple
   - Toggle Apple to enabled
   - Enter `client_id` (Service ID from Apple Developer Console)
   - Enter `client_secret` (Generated JWT)
   - Click Save

### Implementation Details

**Client-side Usage:**
```typescript
import { signInWithApple } from './SupabaseClient';

// Trigger Apple OAuth flow
await signInWithApple();
```

**Callback URL Format:**
- Production: `https://zazsrepfnamdmibcyenx.supabase.co/auth/v1/callback`
- Local: `https://localhost:3000/auth/v1/callback` (for testing)

### Testing and Verification

**Web Testing:**
- Requires actual Apple ID for testing
- Works in Safari and Chrome on macOS/iOS
- Test both sign-up and sign-in flows

**iOS App Testing:**
- Native Sign in with Apple integration
- Custom redirect URL: `list://auth/success`
- Test in iOS Simulator and real devices

### Security Considerations

- **Client Secret Rotation**: Apple recommends rotating client secrets every 6 months
- **Bundle ID Verification**: Ensure Apple Developer Console bundle ID matches app configuration
- **Domain Verification**: Verify callback domains are properly configured in Apple Console

### Common Issues and Solutions

**"Invalid client" error:**
- Verify Service ID matches client_id in Supabase
- Check callback URL is exactly: `https://zazsrepfnamdmibcyenx.supabase.co/auth/v1/callback`
- Ensure Service ID is linked to App ID with Sign in with Apple enabled

**"Invalid client_secret" error:**
- Regenerate client_secret JWT with correct private key
- Verify key ID, team ID, and Service ID in JWT claims
- Check JWT expiration (Apple recommends 6-month maximum)

**Testing limitations:**
- Apple OAuth requires production Apple Developer account
- Cannot test in Expo Go app (requires custom build)
- Web testing requires actual Apple ID login

## JSON Naming Convention

**CRITICAL**: Always use snake_case for JSON keys across all contexts

### Scope of snake_case Usage

All JSON-related keys must use snake_case convention:

1. **JSON Files** - Configuration files, data files, seed data
   ```json
   {
     "supabase_url": "https://example.supabase.co",
     "api_key": "your_key_here",
     "feature_flags": {
       "enable_search": true,
       "max_results": 50
     }
   }
   ```

2. **Database JSON/JSONB Columns** - PostgreSQL JSON fields
   ```sql
   INSERT INTO content (metadata) VALUES ('{"created_at": "2024-01-01", "user_preferences": {"theme": "dark"}}');
   ```

3. **Go Struct Tags** - JSON serialization in Go
   ```go
   type User struct {
       UserID    string `json:"user_id"`
       CreatedAt time.Time `json:"created_at"`
       Settings  map[string]interface{} `json:"user_settings"`
   }
   ```

4. **TypeScript Types** - API interfaces and data models
   ```typescript
   interface ContentItem {
     content_id: string;
     created_at: string;
     user_metadata: {
       last_modified: string;
       view_count: number;
     };
   }
   ```

5. **API Request/Response Payloads** - All HTTP communication
   ```json
   {
     "group_id": "abc123",
     "invite_code": "xyz789",
     "member_count": 5,
     "created_at": "2024-01-01T00:00:00Z"
   }
   ```

### Benefits of Consistent snake_case

- **Database Alignment** - Matches PostgreSQL column naming conventions
- **API Consistency** - Prevents confusion between frontend camelCase and backend snake_case
- **Predictability** - Developers know what to expect across all JSON contexts
- **Tool Compatibility** - Works well with database tools and API clients
- **Migration Safety** - Consistent with existing database schema

### Examples to Avoid

❌ **Mixed conventions in the same context:**
```json
{
  "userId": "123",           // camelCase
  "created_at": "2024-01-01" // snake_case
}
```

✅ **Consistent snake_case:**
```json
{
  "user_id": "123",
  "created_at": "2024-01-01"
}
```

### Exception
The only exception is when interfacing with external APIs that require camelCase - in these cases, transform at the boundary using proper serialization tags or mapping functions.

## iOS Share Extension Architecture

**CRITICAL**: All content saves to the single `content` table, no separate tables for different content types

### Architecture Overview

The iOS Share Extension uses an offline-first inbox pattern:

```
Share Extension → App Group Inbox → Main App → Supabase
```

**Key Principles:**
- **Share Extension is dumb and fast** - Only writes to local inbox, no network/auth
- **Main App owns auth and network** - Drains inbox to Supabase in background
- **Offline-safe** - Shares succeed without network, sync when available
- **No OAuth in extension** - Session tokens shared via Keychain Access Group

### Content Table Structure

All shared URLs save to the `content` table:

```typescript
{
  type: 'text',                    // Always 'text' for shared URLs
  data: 'https://example.com',     // The shared URL
  metadata: {                      // SEOMetadata stored as JSON
    url: 'https://example.com',
    title: 'Page Title',
    domain: 'example.com',
    // ... other SEO fields
  },
  group_id: '<user_default_group>',
  user_id: '<from_session>',
  parent_content_id: null          // Top-level content
}
```

**Important:** Never create separate tables for URLs, bookmarks, or shares. All content types use the same `content` table with different `type` and `metadata` values.

### Implementation Flow

1. **User shares URL from Safari/app**
   - Share sheet appears with extension
   - Extension extracts URL and optional note
   - Creates `ShareItem` with URL, timestamp, note
   - Writes JSON file to App Group inbox (`group.com.breadchris.share`)
   - Posts Darwin notification to wake main app
   - Extension exits immediately (< 1 second)

2. **Main app receives notification**
   - Background task or foreground observer triggers
   - Reads all JSON files from inbox
   - Gets session token from shared Keychain
   - For each item:
     - POST to Supabase `content` table
     - Include `type: 'text'`, URL in `data`, metadata
     - Use user's default `group_id` from session
     - Delete inbox file on success, keep on failure

3. **Content appears in app**
   - Real-time subscription updates UI
   - SEOCard component displays URL preview
   - User sees shared content immediately

### Shared Infrastructure

**App Group Container:**
- Container ID: `group.com.breadchris.share`
- Inbox location: `<container>/inbox/*.json`
- Each file is a `ShareItem` JSON object

**Keychain Access Group:**
- Group ID: `<TEAM_ID>.com.breadchris.shared`
- Stores: Supabase session `access_token`
- Shared between main app and extension

**ShareItem Structure:**
```swift
struct ShareItem: Codable {
  let id: UUID
  let url: String
  let note: String?
  let createdAt: Date
  let userId: UUID?
}
```

### Background Processing

**Main App Background Tasks:**
- Registered task ID: `com.breadchris.list.drain`
- Triggers: Darwin notification, app foreground, scheduled refresh
- Drains inbox to Supabase, deletes successful items
- Retries failed items on next run

**Session Token Management:**
- Main app saves `session.access_token` to shared Keychain on auth
- Parses `user_id` from JWT payload
- Extension never touches tokens, main app reads for API calls

### Error Handling

**Extension Errors:**
- No session token → Item saved to inbox, will sync when authenticated
- No network → Offline-safe, item queued in inbox

**Main App Errors:**
- Network failure → Keep inbox file, retry later
- Auth expired → Trigger re-authentication, keep inbox
- Missing group_id → Use first group or create default group

### Security Considerations

- Never use service_role key in app or extension
- Always use anon key + user access token
- RLS policies enforce user ownership
- Keychain access group prevents token theft
- App Group only shared between main app and extension

### Testing Checklist

- [ ] Share URL from Safari → appears in inbox
- [ ] Main app drains inbox → content in Supabase
- [ ] Offline share → syncs when online
- [ ] Multiple shares → all processed in order
- [ ] Auth expired → re-auth and retry
- [ ] Extension completes < 1 second

## AWS Lambda Development Guidelines

**CRITICAL**: Always test locally with Docker before deploying to AWS

### Lambda Endpoint Architecture

**CRITICAL**: The content Lambda has ONE endpoint only: `/content`

**Design Principles:**
- **Single endpoint pattern** - All content processing operations use POST `/content`
- **Action-based routing** - Functionality is added via the `action` field in the request payload
- **NEVER add new endpoints** - Do not create `/content/seo`, `/content/libgen`, etc.
- **Payload-driven design** - All variations handled through the payload structure

**Request Format:**
```json
{
  "action": "libgen-search",
  "payload": {
    "selectedContent": [...],
    "searchType": "author",
    "topics": ["libgen"],
    "maxResults": 10
  }
}
```

**Why Single Endpoint?**
- Simpler API Gateway configuration
- Consistent routing pattern
- Easier to add features (just add new action type)
- No need to update infrastructure for new functionality
- Clear separation of concerns (routing vs. processing)

**Adding New Functionality:**
1. Add new action type to `ContentRequest` type in `types.ts`
2. Add handler function in `content-handlers.ts`
3. Add case to switch statement in `handleContentRequest()`
4. NO infrastructure changes needed

**Examples of Actions:**
- `seo-extract` - Extract SEO metadata from URLs
- `libgen-search` - Search Library Genesis for books
- `tmdb-search` - Search The Movie Database
- `llm-generate` - Generate content with LLM
- `markdown-extract` - Extract markdown from URLs
- `youtube-playlist-extract` - Extract YouTube playlist videos

### Local-First Development Workflow

The Lambda function for Claude Code execution should always be tested locally before deployment. This provides immediate feedback and avoids slow CloudWatch log debugging.

**Development Loop:**
1. Make code changes in `lambda/function/src/`
2. Test locally with Docker (see below)
3. Iterate until working
4. Deploy to AWS with Pulumi
5. Verify with production curl test

### Local Docker Testing

**Prerequisites:**
- Docker installed and running
- `ANTHROPIC_API_KEY` environment variable set
- AWS credentials configured (for S3 access)

**Quick Test:**
```bash
cd lambda/function

# Build and test in one command
./test-local.sh
```

**Manual Testing:**
```bash
# 1. Build Docker image
docker build -t claude-lambda-test .

# 2. Run Lambda Runtime Interface Emulator
docker run --rm -p 9000:8080 \
  -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
  -e AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}" \
  -e AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}" \
  -e AWS_REGION="us-east-1" \
  -e S3_BUCKET_NAME="claude-code-sessions" \
  -e NODE_ENV="development" \
  claude-lambda-test

# 3. Test with curl (in another terminal)
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -H "Content-Type: application/json" \
  -d @test-payload.json | jq '.'
```

**Using test payload file:**
```bash
# lambda/function/test-payload.json
{
  "body": "{\"prompt\": \"What is 2 + 2?\"}",
  "requestContext": {
    "http": {
      "method": "POST"
    }
  },
  "rawPath": "/claude-code"
}
```

### Debugging Output in Responses

The Lambda function returns detailed debugging information in the HTTP response:

```json
{
  "success": false,
  "session_id": "session-xxx",
  "error": "Claude Code process exited with code 1",
  "stdout": "...captured process stdout...",
  "stderr": "...captured process stderr...",
  "exitCode": 1,
  "messages": []
}
```

**Key fields for debugging:**
- `stdout` - All stdout from Claude Code CLI process
- `stderr` - All stderr from Claude Code CLI process
- `exitCode` - Process exit code (0 = success, 1 = error)
- `error` - High-level error message
- `messages` - SDK messages (empty if process failed early)

### Common Issues and Solutions

**Issue: Console.log not appearing in CloudWatch**
- **Cause**: Node.js Lambda buffers stdout/stderr
- **Solution**: Use `process.stderr.write()` for immediate output, or rely on response debugging fields

**Issue: Docker build fails with missing files**
- **Cause**: .dockerignore excluding necessary files
- **Solution**: Check .dockerignore doesn't exclude tsconfig.json or source files

**Issue: Lambda works locally but fails in AWS**
- **Cause**: Environment variables not set in Pulumi config
- **Solution**: Check `lambda/index.ts` environment variable configuration

**Issue: "Claude Code process exited with code 1"**
- **Debugging**: Check `stdout` and `stderr` fields in response
- **Common causes**: Missing ANTHROPIC_API_KEY, CLI not found, invalid API key

### Deployment After Local Testing

Once local tests pass:

```bash
cd lambda

# Deploy with Pulumi
export PULUMI_CONFIG_PASSPHRASE=""
npm run up -- --yes

# Test production endpoint
curl -X POST "https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/claude-code" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2 + 2?"}' | jq '.'
```

### Lambda Function Architecture

**Structure:**
- `lambda/function/src/index.ts` - API Gateway handler with CORS
- `lambda/function/src/claude-executor.ts` - Claude Code SDK execution with output capture
- `lambda/function/src/session-manager.ts` - S3 session file management
- `lambda/function/Dockerfile` - Container image with Claude CLI installed
- `lambda/index.ts` - Pulumi infrastructure (ECR, Lambda, API Gateway, IAM)

**Key Components:**
- Docker-based Lambda (not ZIP deployment)
- Claude Code CLI installed globally via npm
- Process output captured via SDK hooks
- All output returned in HTTP response for debugging
- S3 for session file storage (optional)

### Best Practices

1. **Always test locally first** - Faster feedback loop than AWS deployment
2. **Use Docker build cache** - Rebuilds are fast when only source changes
3. **Check exit codes** - Process exit code 0 means success
4. **Read stdout/stderr** - Contains actual error messages from CLI
5. **Verify API key** - Most failures are due to missing/invalid ANTHROPIC_API_KEY
6. **Test incrementally** - Start with simple prompts, add complexity gradually