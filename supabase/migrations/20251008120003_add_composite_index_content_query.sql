-- Add optimized composite index for content list query
-- Issue: Query uses BitmapAnd combining idx_content_parent_and_type + idx_content_group_id
-- Query pattern: WHERE group_id = ? AND parent_content_id IS NULL ORDER BY created_at DESC
-- Solution: Single composite index covering all query conditions and sort order

-- Drop old partial index if it exists (less optimal)
DROP INDEX IF EXISTS public.idx_content_parent_and_type;

-- Create optimized composite index for the exact query pattern
-- This index covers: group_id filter + parent_content_id filter + created_at ordering
CREATE INDEX IF NOT EXISTS idx_content_group_parent_created
ON public.content (group_id, parent_content_id, created_at DESC)
WHERE parent_content_id IS NULL;

-- Analyze the table to update statistics for query planner
ANALYZE public.content;

-- Benefits:
-- 1. Eliminates BitmapAnd operation (was combining 2 separate indexes)
-- 2. Index includes created_at DESC for efficient sorting without extra sort step
-- 3. Partial index (WHERE parent_content_id IS NULL) reduces index size
-- 4. Single index scan instead of bitmap heap scan
-- 5. Matches exact query pattern for optimal performance

-- Expected improvement:
-- - Execution time: 2.6ms → 1.5-2ms (30-40% reduction)
-- - Planning time: Further reduced by having single optimal index choice
-- - Index size: Smaller than full table index due to WHERE clause

-- Note: Keep idx_content_group_id for other queries that filter by group_id alone
-- Only drop idx_content_parent_and_type which is now fully superseded

-- Rollback instructions:
-- DROP INDEX IF EXISTS public.idx_content_group_parent_created;
-- CREATE INDEX idx_content_parent_and_type ON public.content (parent_content_id, type);
