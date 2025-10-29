-- Migration: Remove SEO-specific RLS policy and function
--
-- Context: The "SEO content inherits parent permissions" policy (FOR ALL) uses a
-- SECURITY DEFINER function that causes issues with PostgREST foreign key joins,
-- resulting in NULL children in query results.
--
-- Solution: Remove the SEO-specific policy entirely. SEO content will use the same
-- group-based permissions as all other content types.

-- Drop the problematic SEO policy
DROP POLICY IF EXISTS "SEO content inherits parent permissions" ON content;

-- Drop the SECURITY DEFINER function since it's no longer needed
DROP FUNCTION IF EXISTS check_user_can_access_parent_content(UUID, UUID);

-- SEO content will now use the standard "Content is viewable by group members" policy
-- This means SEO content follows the same access rules as all other content:
-- - Viewable by members of the content's group
-- - No special parent-based inheritance

-- Add comment for documentation
COMMENT ON POLICY "Content is viewable by group members" ON content IS
  'Allows group members to view all content in their groups, including SEO content. SEO content no longer has special parent-based permissions.';
