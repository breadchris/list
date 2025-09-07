-- Fix infinite recursion in content RLS policy
-- This migration creates a SECURITY DEFINER function to break the RLS recursion cycle

-- Create function to check if content has public ancestor (bypasses RLS)
CREATE OR REPLACE FUNCTION check_content_has_public_ancestor(content_path ltree)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_public_ancestor boolean := false;
BEGIN
  -- Check if any ancestor in the path is marked as public
  -- This function runs with elevated privileges to bypass RLS
  SELECT EXISTS (
    SELECT 1 FROM content ancestor 
    WHERE content_path ~ (ancestor.path::text || '.*')::lquery
    AND (ancestor.metadata->'sharing'->>'isPublic')::boolean = true
  ) INTO has_public_ancestor;
  
  RETURN has_public_ancestor;
END;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION check_content_has_public_ancestor(ltree) TO anon, authenticated;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Public content and descendants are viewable by anyone" ON content;

-- Create new policy using the SECURITY DEFINER function
CREATE POLICY "Public content and descendants are viewable by anyone"
ON "public"."content"
AS PERMISSIVE FOR SELECT 
TO public
USING (
  -- Content is accessible if any ancestor in its path is marked as public
  check_content_has_public_ancestor(path)
);

-- Add comment for documentation
COMMENT ON FUNCTION check_content_has_public_ancestor(ltree) IS 'Checks if content has a public ancestor in its ltree path. Uses SECURITY DEFINER to bypass RLS recursion.';