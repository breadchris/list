-- Migration: Fix infinite recursion in content_relationships RLS policies
--
-- Context: The content_relationships policies query the content table,
-- which causes infinite recursion. This migration creates SECURITY DEFINER
-- functions to break the recursion cycle.

-- Function to check if user has access to content (bypasses RLS)
CREATE OR REPLACE FUNCTION check_user_can_access_content(
  content_id_param UUID,
  user_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_access BOOLEAN := FALSE;
BEGIN
  -- Check if user is a member of the content's group
  SELECT EXISTS (
    SELECT 1
    FROM content c
    JOIN group_memberships gm ON gm.group_id = c.group_id
    WHERE c.id = content_id_param
      AND gm.user_id = user_id_param
  ) INTO has_access;

  RETURN has_access;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION check_user_can_access_content(UUID, UUID) TO authenticated, anon;

-- Drop existing policies
DROP POLICY IF EXISTS "Relationships viewable if can see parent or child" ON content_relationships;
DROP POLICY IF EXISTS "Can create relationships for accessible content" ON content_relationships;
DROP POLICY IF EXISTS "Can update relationships for accessible content" ON content_relationships;
DROP POLICY IF EXISTS "Can delete relationships for accessible content" ON content_relationships;

-- Policy: Users can view relationships if they have access to parent OR child
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "Relationships viewable if can see parent or child"
ON content_relationships FOR SELECT
USING (
  -- Root relationships: check child access only
  (
    from_content_id IS NULL
    AND check_user_can_access_content(to_content_id, auth.uid())
  )
  OR
  -- Child relationships: check parent OR child access
  (
    from_content_id IS NOT NULL
    AND (
      check_user_can_access_content(from_content_id, auth.uid())
      OR check_user_can_access_content(to_content_id, auth.uid())
    )
  )
);

-- Policy: Users can create relationships if they have access to both parent and child
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "Can create relationships for accessible content"
ON content_relationships FOR INSERT
WITH CHECK (
  -- Root relationships: check child access only
  (
    from_content_id IS NULL
    AND check_user_can_access_content(to_content_id, auth.uid())
  )
  OR
  -- Child relationships: must have access to both parent AND child
  (
    from_content_id IS NOT NULL
    AND check_user_can_access_content(from_content_id, auth.uid())
    AND check_user_can_access_content(to_content_id, auth.uid())
  )
);

-- Policy: Users can update relationships they have access to
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "Can update relationships for accessible content"
ON content_relationships FOR UPDATE
USING (
  -- Root relationships: check child access only
  (
    from_content_id IS NULL
    AND check_user_can_access_content(to_content_id, auth.uid())
  )
  OR
  -- Child relationships: must have access to both parent AND child
  (
    from_content_id IS NOT NULL
    AND check_user_can_access_content(from_content_id, auth.uid())
    AND check_user_can_access_content(to_content_id, auth.uid())
  )
);

-- Policy: Users can delete relationships they have access to
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "Can delete relationships for accessible content"
ON content_relationships FOR DELETE
USING (
  -- Root relationships: check child access only
  (
    from_content_id IS NULL
    AND check_user_can_access_content(to_content_id, auth.uid())
  )
  OR
  -- Child relationships: must have access to both parent AND child
  (
    from_content_id IS NOT NULL
    AND check_user_can_access_content(from_content_id, auth.uid())
    AND check_user_can_access_content(to_content_id, auth.uid())
  )
);

-- Add comment for documentation
COMMENT ON FUNCTION check_user_can_access_content(UUID, UUID) IS
  'Checks if user has access to content by checking group membership. Uses SECURITY DEFINER to bypass RLS recursion.';
