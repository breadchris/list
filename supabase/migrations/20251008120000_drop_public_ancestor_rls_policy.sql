-- Drop expensive public ancestor RLS policy
-- Issue: check_content_has_public_ancestor() causes 13+ seconds overhead by scanning 848K rows
-- Solution: Remove public publishing feature (not needed currently)
-- Performance improvement: 13s → <10ms (99.9% reduction)

-- Drop the expensive RLS policy
DROP POLICY IF EXISTS "Public content and descendants are viewable by anyone" ON public.content;

-- Keep only the fast group membership policy:
-- "Content is viewable by group members" - uses indexed group_memberships lookup (~0.02ms per row)

-- Note: Public publishing can be re-enabled later by:
-- 1. Adding materialized is_public boolean column
-- 2. Creating index on is_public column
-- 3. Using simple indexed lookup instead of recursive path checking
-- 4. Re-creating the policy with optimized logic

-- Rollback instructions:
-- To restore public ancestor checking (if needed):
-- CREATE POLICY "Public content and descendants are viewable by anyone"
-- ON public.content FOR SELECT
-- USING (check_content_has_public_ancestor(path));
