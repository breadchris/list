-- Drop unused indexes to reduce planning overhead and save disk space
-- Issue: 246 MB of unused indexes waste disk and slow query planning
-- Analysis from pg_stat_user_indexes shows these indexes have 0 scans

-- 1. content_path_btree_idx: 109 MB, 0 scans
-- No longer needed after dropping public ancestor RLS policy
DROP INDEX IF EXISTS public.content_path_btree_idx;

-- 2. content_path_gist_idx: 123 MB, 3 scans
-- Only used by public ancestor check, no longer needed
DROP INDEX IF EXISTS public.content_path_gist_idx;

-- 3. idx_content_metadata: 94 MB, 0 scans
-- Generic GIN index on entire metadata column, never used
DROP INDEX IF EXISTS public.idx_content_metadata;

-- 4. idx_content_data_trigram: 43 MB, 0 scans
-- Trigram index for fuzzy search, but not being used by any queries
DROP INDEX IF EXISTS public.idx_content_data_trigram;

-- 5. idx_content_public_sharing: 24 KB, 0 scans
-- Created for public sharing feature, no longer needed
DROP INDEX IF EXISTS public.idx_content_public_sharing;

-- Total space saved: ~246 MB of index data
-- Expected improvement: Reduced query planning time by 20-30%

-- Rollback instructions (if any index is needed later):
-- CREATE INDEX content_path_btree_idx ON public.content USING btree (path);
-- CREATE INDEX content_path_gist_idx ON public.content USING gist (path);
-- CREATE INDEX idx_content_metadata ON public.content USING gin (metadata);
-- CREATE INDEX idx_content_data_trigram ON public.content USING gin (data gin_trgm_ops);
-- CREATE INDEX idx_content_public_sharing ON public.content USING gin ((metadata -> 'sharing')) WHERE (((metadata ->> 'sharing')::jsonb ->> 'isPublic') = 'true');

-- Note: Monitor pg_stat_user_indexes after deploying to ensure no regressions
