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