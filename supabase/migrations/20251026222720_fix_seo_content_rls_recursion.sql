-- Migration: Fix infinite recursion in SEO content RLS policy
--
-- Context: The "SEO content inherits parent permissions" policy queries
-- the content table recursively (FROM content parent WHERE parent.id = ...)
-- which causes infinite recursion. This migration fixes it using a
-- SECURITY DEFINER function to break the cycle.

-- Function to check if user has access to parent content (bypasses RLS)
CREATE OR REPLACE FUNCTION check_user_can_access_parent_content(
  parent_id_param UUID,
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
  -- Check if user is a member of the parent content's group
  SELECT EXISTS (
    SELECT 1
    FROM content c
    JOIN group_memberships gm ON gm.group_id = c.group_id
    WHERE c.id = parent_id_param
      AND gm.user_id = user_id_param
  ) INTO has_access;

  RETURN has_access;
END;
$$;

-- Grant execute to authenticated users and anon
GRANT EXECUTE ON FUNCTION check_user_can_access_parent_content(UUID, UUID) TO authenticated, anon;

-- Drop the problematic policy
DROP POLICY IF EXISTS "SEO content inherits parent permissions" ON "public"."content";

-- Recreate the policy using SECURITY DEFINER function to avoid recursion
CREATE POLICY "SEO content inherits parent permissions"
ON "public"."content"
AS PERMISSIVE
FOR ALL
TO public
USING (
    CASE
        WHEN type = 'seo' AND parent_content_id IS NOT NULL THEN
            -- Use SECURITY DEFINER function to check parent access without recursion
            check_user_can_access_parent_content(parent_content_id, auth.uid())
        ELSE
            -- Use existing policies for non-SEO content
            EXISTS (
                SELECT 1 FROM group_memberships
                WHERE group_memberships.group_id = content.group_id
                AND group_memberships.user_id::text = auth.uid()::text
            )
    END
)
WITH CHECK (
    CASE
        WHEN type = 'seo' AND parent_content_id IS NOT NULL THEN
            -- Use SECURITY DEFINER function to check parent access without recursion
            check_user_can_access_parent_content(parent_content_id, auth.uid())
        ELSE
            -- Use existing policies for non-SEO content
            user_id::text = auth.uid()::text
            AND EXISTS (
                SELECT 1 FROM group_memberships
                WHERE group_memberships.group_id = content.group_id
                AND group_memberships.user_id::text = auth.uid()::text
            )
    END
);

-- Add comment for documentation
COMMENT ON FUNCTION check_user_can_access_parent_content(UUID, UUID) IS
  'Checks if user has access to parent content by checking group membership. Uses SECURITY DEFINER to bypass RLS recursion.';
