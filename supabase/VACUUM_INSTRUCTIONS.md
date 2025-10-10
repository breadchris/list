# Manual VACUUM Instructions

## Issue
Dead tuples in tables slow down JOIN operations and waste disk space:
- `group_memberships`: 65% dead tuples (15 dead / 8 live)
- `content_tags`: 73% dead tuples (24 dead / 9 live)
- `tags`: 53% dead tuples (8 dead / 7 live)

## Why Not in Migration?
VACUUM cannot be executed within a transaction, and Supabase migrations run within transactions by default.
Therefore, VACUUM must be run manually as a separate maintenance operation.

## How to Run

### Production (Supabase Dashboard)
1. Go to Supabase Dashboard > SQL Editor
2. Run the following SQL commands one by one:

```sql
VACUUM ANALYZE public.group_memberships;
VACUUM ANALYZE public.content_tags;
VACUUM ANALYZE public.tags;
```

### Local Development (MCP Server)
Use the Supabase MCP server to execute SQL:

```sql
VACUUM ANALYZE public.group_memberships;
VACUUM ANALYZE public.content_tags;
VACUUM ANALYZE public.tags;
```

## Benefits
- Faster JOIN operations (fewer dead tuples to skip)
- Better query planning (updated statistics)
- Reduced disk space usage
- Improved cache efficiency

## When to Run
- After large DELETE or UPDATE operations
- When dead tuple percentage exceeds 20-30%
- Periodically as part of database maintenance
- Or enable autovacuum more aggressively in PostgreSQL settings

## Alternative: Enable Autovacuum
Instead of manual VACUUM, you can configure PostgreSQL autovacuum to run more frequently:

```sql
-- Make autovacuum more aggressive (production only)
ALTER TABLE public.group_memberships SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE public.content_tags SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE public.tags SET (autovacuum_vacuum_scale_factor = 0.1);
```

This makes autovacuum trigger when 10% of rows are dead, instead of the default 20%.
