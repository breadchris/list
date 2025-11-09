-- Add INSERT, UPDATE, and DELETE policies to tags table
-- This fixes the 403 Forbidden error when trying to create tags
--
-- Context: Migration 20251028194627 re-enabled RLS on tags but only
-- added a SELECT policy. Users need INSERT/UPDATE/DELETE permissions to create tags.
--
-- Security Model: User-owned tags
-- - Each tag has a user_id indicating who created it
-- - Users can only modify their own tags (user_id = auth.uid())
-- - Tags are visible to all users (SELECT policy already exists)
-- - Prevents users from modifying other users' tags

-- Policy: Authenticated users can create their own tags
CREATE POLICY "Users can create their own tags"
ON tags
FOR INSERT
TO authenticated
WITH CHECK (user_id::text = auth.uid()::text);

-- Policy: Users can update their own tags
CREATE POLICY "Users can update their own tags"
ON tags
FOR UPDATE
TO authenticated
USING (user_id::text = auth.uid()::text);

-- Policy: Users can delete their own tags
CREATE POLICY "Users can delete their own tags"
ON tags
FOR DELETE
TO authenticated
USING (user_id::text = auth.uid()::text);

-- Add comment documenting the complete security model
COMMENT ON TABLE tags IS 'User-created labels for categorizing content. RLS enabled with SELECT (permissive for all users) + INSERT/UPDATE/DELETE (user ownership check). Users can see all tags but can only modify their own.';
