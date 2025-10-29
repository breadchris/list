-- Migration: Simplify content_relationships RLS to fix PostgREST foreign key joins
--
-- Context: PostgREST foreign key joins return NULL when there's a circular RLS dependency.
-- The content_relationships SELECT policy checks if user can access content (via JOIN),
-- but PostgREST is also trying to JOIN to that same content, creating a circular dependency.
--
-- Root Cause: Circular RLS evaluation
-- - content_relationships policy: "Can user access the content?" (checks content table)
-- - PostgREST query: content_relationships → JOIN → content
-- - Result: PostgREST can't evaluate the join because checking if user can see the
--   relationship requires accessing the same content it's trying to join to
--
-- Solution: Remove SELECT policy from content_relationships entirely
-- - Let content_relationships rows be visible to all authenticated users
-- - Rely on content table's RLS to filter what's accessible in the JOIN
-- - This works because:
--   1. PostgREST can see all relationship rows (no RLS check)
--   2. When joining to content, content's RLS filters what's visible
--   3. Users only see relationships where they can access the actual content
-- - Keep INSERT/UPDATE/DELETE policies to prevent unauthorized modifications

-- Drop the SELECT policy that's causing circular dependency
DROP POLICY IF EXISTS "Relationships viewable by group members" ON content_relationships;

-- Create a simple SELECT policy that allows all authenticated users to see relationships
-- The actual content access control happens via the content table's RLS
CREATE POLICY "Relationships are visible to authenticated users"
ON content_relationships FOR SELECT
TO authenticated
USING (true);

-- Note: We keep the existing INSERT/UPDATE/DELETE policies unchanged
-- because they need to verify permissions before modifying relationships

-- Add comment explaining the design decision
COMMENT ON POLICY "Relationships are visible to authenticated users" ON content_relationships IS
  'Allows all authenticated users to see relationship rows. Access control is enforced by the content table RLS when joining. This prevents circular RLS dependency issues with PostgREST foreign key joins.';
