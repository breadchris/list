-- Migration: Fix RLS policies to handle NULL from_content_id (root relationships)
--
-- Context: The original RLS policies check "content.id = from_content_id" which fails
-- when from_content_id is NULL (root items). This migration updates all policies to
-- handle root relationships correctly.

-- Drop all existing policies
DROP POLICY IF EXISTS "Relationships viewable if can see parent or child" ON content_relationships;
DROP POLICY IF EXISTS "Can create relationships for accessible content" ON content_relationships;
DROP POLICY IF EXISTS "Can update relationships for accessible content" ON content_relationships;
DROP POLICY IF EXISTS "Can delete relationships for accessible content" ON content_relationships;

-- Policy: Users can view relationships if they have access to parent OR child
-- For root relationships (from_content_id IS NULL), only check child access
CREATE POLICY "Relationships viewable if can see parent or child"
ON content_relationships FOR SELECT
USING (
  -- Root relationships: check child access only
  (
    from_content_id IS NULL
    AND EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_relationships.to_content_id
      AND EXISTS (
        SELECT 1 FROM group_memberships
        WHERE group_memberships.group_id = content.group_id
        AND group_memberships.user_id::text = auth.uid()::text
      )
    )
  )
  OR
  -- Child relationships: check parent OR child access
  (
    from_content_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM content
        WHERE content.id = content_relationships.from_content_id
        AND EXISTS (
          SELECT 1 FROM group_memberships
          WHERE group_memberships.group_id = content.group_id
          AND group_memberships.user_id::text = auth.uid()::text
        )
      )
      OR
      EXISTS (
        SELECT 1 FROM content
        WHERE content.id = content_relationships.to_content_id
        AND EXISTS (
          SELECT 1 FROM group_memberships
          WHERE group_memberships.group_id = content.group_id
          AND group_memberships.user_id::text = auth.uid()::text
        )
      )
    )
  )
);

-- Policy: Users can create relationships if they have access to both parent and child
-- For root relationships (from_content_id IS NULL), only check child access
CREATE POLICY "Can create relationships for accessible content"
ON content_relationships FOR INSERT
WITH CHECK (
  -- Root relationships: check child access only
  (
    from_content_id IS NULL
    AND EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_relationships.to_content_id
      AND EXISTS (
        SELECT 1 FROM group_memberships
        WHERE group_memberships.group_id = content.group_id
        AND group_memberships.user_id::text = auth.uid()::text
      )
    )
  )
  OR
  -- Child relationships: must have access to both parent AND child
  (
    from_content_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_relationships.from_content_id
      AND EXISTS (
        SELECT 1 FROM group_memberships
        WHERE group_memberships.group_id = content.group_id
        AND group_memberships.user_id::text = auth.uid()::text
      )
    )
    AND EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_relationships.to_content_id
      AND EXISTS (
        SELECT 1 FROM group_memberships
        WHERE group_memberships.group_id = content.group_id
        AND group_memberships.user_id::text = auth.uid()::text
      )
    )
  )
);

-- Policy: Users can update relationships they have access to
-- For root relationships (from_content_id IS NULL), only check child access
CREATE POLICY "Can update relationships for accessible content"
ON content_relationships FOR UPDATE
USING (
  -- Root relationships: check child access only
  (
    from_content_id IS NULL
    AND EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_relationships.to_content_id
      AND EXISTS (
        SELECT 1 FROM group_memberships
        WHERE group_memberships.group_id = content.group_id
        AND group_memberships.user_id::text = auth.uid()::text
      )
    )
  )
  OR
  -- Child relationships: must have access to both parent AND child
  (
    from_content_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_relationships.from_content_id
      AND EXISTS (
        SELECT 1 FROM group_memberships
        WHERE group_memberships.group_id = content.group_id
        AND group_memberships.user_id::text = auth.uid()::text
      )
    )
    AND EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_relationships.to_content_id
      AND EXISTS (
        SELECT 1 FROM group_memberships
        WHERE group_memberships.group_id = content.group_id
        AND group_memberships.user_id::text = auth.uid()::text
      )
    )
  )
);

-- Policy: Users can delete relationships they have access to
-- For root relationships (from_content_id IS NULL), only check child access
CREATE POLICY "Can delete relationships for accessible content"
ON content_relationships FOR DELETE
USING (
  -- Root relationships: check child access only
  (
    from_content_id IS NULL
    AND EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_relationships.to_content_id
      AND EXISTS (
        SELECT 1 FROM group_memberships
        WHERE group_memberships.group_id = content.group_id
        AND group_memberships.user_id::text = auth.uid()::text
      )
    )
  )
  OR
  -- Child relationships: must have access to both parent AND child
  (
    from_content_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_relationships.from_content_id
      AND EXISTS (
        SELECT 1 FROM group_memberships
        WHERE group_memberships.group_id = content.group_id
        AND group_memberships.user_id::text = auth.uid()::text
      )
    )
    AND EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_relationships.to_content_id
      AND EXISTS (
        SELECT 1 FROM group_memberships
        WHERE group_memberships.group_id = content.group_id
        AND group_memberships.user_id::text = auth.uid()::text
      )
    )
  )
);