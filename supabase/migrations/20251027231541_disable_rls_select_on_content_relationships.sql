-- Migration: Disable SELECT RLS policy on content_relationships
--
-- Context: PostgREST foreign key joins continue to return NULL even with a simple
-- USING (true) policy. Any RLS policy on the join table appears to interfere with
-- PostgREST's query planning for embedded resources.
--
-- Root Cause: RLS policies on join tables (even simple ones) block PostgREST from
-- properly evaluating foreign key joins, resulting in NULL embedded resources.
--
-- Solution: Remove SELECT policy entirely from content_relationships.
-- - Let content_relationships rows be visible to all roles (no SELECT policy)
-- - Keep RLS enabled for INSERT/UPDATE/DELETE to prevent unauthorized modifications
-- - Rely entirely on content table's RLS to control what users can access
--
-- Security Analysis:
-- - content_relationships is a pure join table with no sensitive data
-- - It only contains: from_content_id, to_content_id, display_order
-- - All actual content access is controlled by content table's RLS (group membership)
-- - When PostgREST joins content_relationships → content, the content RLS filters results
-- - Users can only see relationships where they can access the actual content
-- - Write operations (INSERT/UPDATE/DELETE) still have RLS protection

-- Drop the SELECT policy that's blocking PostgREST foreign key joins
DROP POLICY IF EXISTS "Relationships are visible to authenticated users" ON content_relationships;

-- Note: We intentionally do NOT create a replacement SELECT policy
-- This allows all roles (anon, authenticated, service) to see relationship rows
-- Access control happens at the content table level

-- Add comment explaining why there's no SELECT policy
COMMENT ON TABLE content_relationships IS
  'Join table for content hierarchy. No SELECT RLS policy to allow PostgREST foreign key joins. Access control enforced by content table RLS when joining.';
