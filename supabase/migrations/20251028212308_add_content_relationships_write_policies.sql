-- Add INSERT, UPDATE, and DELETE policies to content_relationships table
-- This fixes the 403 Forbidden error when trying to create content relationships
--
-- Context: Migration 20251028194627 re-enabled RLS on content_relationships but only
-- added a SELECT policy. Users need INSERT/UPDATE/DELETE permissions to manage relationships.
--
-- Security Model: "Security enforced via content table RLS"
-- - Users can modify relationships only for content they have access to
-- - Access determined by group membership (user must be member of content's group)
-- - For root relationships (from_content_id IS NULL): Check access to child only
-- - For child relationships: Check access to both parent and child

-- Policy: Users can create relationships for content in their groups
CREATE POLICY "Users can create relationships in their groups"
ON content_relationships FOR INSERT
TO authenticated
WITH CHECK (
  -- For root relationships (from_content_id IS NULL)
  -- Only need to check if user has access to the child content
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
  -- User must have access to both parent and child content
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
TO authenticated
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
TO authenticated
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
COMMENT ON POLICY "Users can create relationships in their groups" ON content_relationships IS
  'Allows users to create relationships for content in their groups. For root relationships (from_content_id IS NULL), checks child access only. For child relationships, user must have access to both parent and child content.';

COMMENT ON POLICY "Users can update relationships in their groups" ON content_relationships IS
  'Allows users to update relationships for content in their groups.';

COMMENT ON POLICY "Users can delete relationships in their groups" ON content_relationships IS
  'Allows users to delete relationships for content in their groups.';

-- Update table comment to document complete security model
COMMENT ON TABLE content_relationships IS 'Content relationships join table. RLS enabled with SELECT (permissive) + INSERT/UPDATE/DELETE (group membership check). Security enforced via content table RLS.';
