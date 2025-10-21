# Claude Code Configuration

## Table of Contents

This document contains high-level project guidelines. For specialized topics, see:

- **[`/tests/CLAUDE.md`](tests/CLAUDE.md)** - Testing guidelines, authentication patterns, test configuration
- **[`/supabase/CLAUDE.md`](supabase/CLAUDE.md)** - Database migrations, local development lifecycle, performance debugging
- **[`/lambda/CLAUDE.md`](lambda/CLAUDE.md)** - AWS Lambda development, local Docker testing, deployment
- **[`/lambda/function/go/CLAUDE.md`](lambda/function/go/CLAUDE.md)** - Go testing patterns, test-as-script development
- **[`/components/CLAUDE.md`](components/CLAUDE.md)** - Frontend development, React Query, OAuth configuration

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
- `/lambda/` - AWS Lambda functions and infrastructure
- `/hooks/` - React hooks for data fetching and state management

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
- `DEEPGRAM_API_KEY` - Deepgram API key for audio transcription with word-level timing

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
