# Claude Code Configuration

## Development Environment

- This is a React TypeScript project with Supabase backend
- Never attempt to run tests or the development server (npm run dev, npm test, etc.)
- The project uses Tailwind CSS for styling

## Project Structure

- `/components/` - React components
- `/data/` - Test configuration files
- `/supabase/` - Supabase configuration and migrations
- `/types/` - TypeScript type definitions

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