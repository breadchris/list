-- Migration: Remove SECURITY DEFINER function from content_relationships RLS policies
--
-- Context: PostgREST foreign key joins return NULL when RLS policies use
-- SECURITY DEFINER functions. This causes queries like:
-- .from('content_relationships').select('..., child:content!to_content_id(*)')
-- to return {"child": null} instead of actual content data.
--
-- Root Cause: The check_user_can_access_content() SECURITY DEFINER function
-- interferes with PostgREST's query planning for foreign key joins.
--
-- Solution: Replace all policies with inline EXISTS checks that don't use functions.
-- This matches the pattern used on the content table, which works correctly.

-- Drop existing policies that use SECURITY DEFINER function
DROP POLICY IF EXISTS "Relationships viewable if can see parent or child" ON content_relationships;
DROP POLICY IF EXISTS "Can create relationships for accessible content" ON content_relationships;
DROP POLICY IF EXISTS "Can update relationships for accessible content" ON content_relationships;
DROP POLICY IF EXISTS "Can delete relationships for accessible content" ON content_relationships;

-- Drop the SECURITY DEFINER function
DROP FUNCTION IF EXISTS check_user_can_access_content(UUID, UUID);

-- Policy: Users can view relationships if they have access to the child content
-- Uses inline EXISTS check instead of SECURITY DEFINER function
CREATE POLICY "Relationships viewable by group members"
ON content_relationships FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM content c
    JOIN group_memberships gm ON gm.group_id = c.group_id
    WHERE c.id = to_content_id
      AND gm.user_id = auth.uid()
  )
);

-- Policy: Users can create relationships for content in their groups
CREATE POLICY "Users can create relationships in their groups"
ON content_relationships FOR INSERT
WITH CHECK (
  -- For root relationships (from_content_id IS NULL)
  (
    from_content_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM content c
      JOIN group_memberships gm ON gm.group_id = c.group_id
      WHERE c.id = to_content_id
        AND gm.user_id = auth.uid()
    )
  )
  OR
  -- For child relationships (from_content_id IS NOT NULL)
  (
    from_content_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM content c1
      JOIN group_memberships gm1 ON gm1.group_id = c1.group_id
      WHERE c1.id = from_content_id
        AND gm1.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM content c2
      JOIN group_memberships gm2 ON gm2.group_id = c2.group_id
      WHERE c2.id = to_content_id
        AND gm2.user_id = auth.uid()
    )
  )
);

-- Policy: Users can update relationships for content in their groups
CREATE POLICY "Users can update relationships in their groups"
ON content_relationships FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM content c
    JOIN group_memberships gm ON gm.group_id = c.group_id
    WHERE c.id = to_content_id
      AND gm.user_id = auth.uid()
  )
);

-- Policy: Users can delete relationships for content in their groups
CREATE POLICY "Users can delete relationships in their groups"
ON content_relationships FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM content c
    JOIN group_memberships gm ON gm.group_id = c.group_id
    WHERE c.id = to_content_id
      AND gm.user_id = auth.uid()
  )
);

-- Add comments for documentation
COMMENT ON POLICY "Relationships viewable by group members" ON content_relationships IS
  'Allows users to view relationships for content in their groups. Uses inline EXISTS check instead of SECURITY DEFINER function to ensure PostgREST foreign key joins work correctly.';

COMMENT ON POLICY "Users can create relationships in their groups" ON content_relationships IS
  'Allows users to create relationships for content in their groups. For child relationships, user must have access to both parent and child content.';

COMMENT ON POLICY "Users can update relationships in their groups" ON content_relationships IS
  'Allows users to update relationships for content in their groups.';

COMMENT ON POLICY "Users can delete relationships in their groups" ON content_relationships IS
  'Allows users to delete relationships for content in their groups.';
