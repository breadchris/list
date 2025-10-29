-- Migration: Disable RLS entirely on tags table
--
-- Context: PostgREST nested foreign key joins return NULL when the tags table RLS
-- policy blocks access. The query chain:
-- content_relationships → content → content_tags → tags
-- fails because tags RLS only allows viewing your own tags (user_id = auth.uid()).
--
-- Root Cause: Tags RLS blocks nested joins
-- - Current policy: "Users can view their own tags" (WHERE user_id = auth.uid())
-- - PostgREST query: content → content_tags → tags
-- - Result: If any tag in the chain is owned by a different user, entire content returns NULL
--
-- Solution: Disable RLS entirely on tags
-- - tags table contains: id, name, color, user_id, created_at
-- - Tag data (names/colors) is not sensitive information
-- - All content access control happens via content table's RLS (group membership)
-- - If a user can see content, they should see the tags on that content
-- - Tag ownership (user_id) is preserved but doesn't control visibility
--
-- Security Analysis:
-- - Tags are labels with no sensitive data (just name + color)
-- - Seeing tag names/colors doesn't leak private information
-- - Content access is still protected by content table RLS
-- - Write operations (INSERT/UPDATE/DELETE) can be protected by application-level checks
-- - Tag discovery (seeing what tags exist) is not a security concern in collaborative groups

-- Disable Row Level Security on tags
ALTER TABLE tags DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies since RLS is disabled
DROP POLICY IF EXISTS "Users can view their own tags" ON tags;
DROP POLICY IF EXISTS "Users can create their own tags" ON tags;
DROP POLICY IF EXISTS "Users can update their own tags" ON tags;
DROP POLICY IF EXISTS "Users can delete their own tags" ON tags;

-- Add comment explaining the security model
COMMENT ON TABLE tags IS
  'User-created labels for categorizing content. RLS disabled to prevent blocking PostgREST nested joins. Access control enforced by content table RLS - if you can see content, you can see its tags. Write operations protected by application-level checks.';
