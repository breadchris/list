# Supabase Database Guidelines

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

## Performance Debugging Methodology

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

## RLS Policy Testing

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

## Migration Rollback Strategies

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

## Best Practices Summary

1. **Never skip local testing** - Always `npx supabase db reset` before production
2. **Measure with RLS enabled** - Superuser measurements are misleading
3. **Document baseline metrics** - Know current performance before optimizing
4. **Test rollback procedures** - Ensure you can undo changes safely
5. **Iterate locally first** - Fix issues in development, not production
6. **Use Supabase MCP tools** - Prefer `mcp__supabase__apply_migration` over manual SQL
7. **Check migration history** - Ensure migrations are tracked and versioned
8. **Vacuum after large changes** - Dead tuples impact performance significantly
