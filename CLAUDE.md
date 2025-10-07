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