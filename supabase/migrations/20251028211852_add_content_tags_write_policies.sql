-- Add INSERT, UPDATE, and DELETE policies to content_tags table
-- This fixes the 403 Forbidden error when trying to add tags to content
--
-- Context: Migration 20251028194627 re-enabled RLS on content_tags but only
-- added a SELECT policy. Users need INSERT/UPDATE/DELETE permissions to manage tags.
--
-- Security Model: "Security enforced via content table RLS"
-- - Users can modify tag relationships only for content they have access to
-- - Access determined by group membership (user must be member of content's group)
-- - content_tags is a join table with no sensitive data itself

-- Policy: Users can add tags to content they have access to
CREATE POLICY "Users can add tags to accessible content"
ON content_tags
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM content
    WHERE content.id = content_tags.content_id
    AND EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_memberships.group_id = content.group_id
      AND group_memberships.user_id::text = auth.uid()::text
    )
  )
);

-- Policy: Users can update tag relationships for accessible content
CREATE POLICY "Users can update tags on accessible content"
ON content_tags
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM content
    WHERE content.id = content_tags.content_id
    AND EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_memberships.group_id = content.group_id
      AND group_memberships.user_id::text = auth.uid()::text
    )
  )
);

-- Policy: Users can remove tags from accessible content
CREATE POLICY "Users can remove tags from accessible content"
ON content_tags
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM content
    WHERE content.id = content_tags.content_id
    AND EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_memberships.group_id = content.group_id
      AND group_memberships.user_id::text = auth.uid()::text
    )
  )
);

-- Add comment documenting the complete security model
COMMENT ON TABLE content_tags IS 'Content tags join table. RLS enabled with SELECT (permissive) + INSERT/UPDATE/DELETE (group membership check). Security enforced via content table RLS.';
