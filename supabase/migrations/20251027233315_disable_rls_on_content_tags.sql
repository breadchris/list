-- Migration: Disable RLS entirely on content_tags table
--
-- Context: PostgREST nested foreign key joins return NULL when intermediate tables
-- have RLS policies that create circular dependencies. The query:
-- content_relationships → content → content_tags → tags
-- fails because content_tags RLS policy queries the content table again.
--
-- Root Cause: Nested circular RLS dependency
-- - content_tags policy: "Can user access the content?" (queries content + group_memberships)
-- - PostgREST query: content → content_tags (trying to join to content_tags)
-- - Result: PostgREST returns NULL for entire content object
--
-- Solution: Disable RLS entirely on content_tags
-- - content_tags is a pure join table (many-to-many between content and tags)
-- - Only contains: content_id, tag_id, created_at
-- - All access control happens via content table's RLS (group membership check)
-- - When PostgREST joins content → content_tags, users only see tags for content
--   they have access to based on content table's RLS policies
--
-- Security Analysis:
-- - content_tags is a mapping table with no sensitive data
-- - Tag associations (which tags are on which content) are not sensitive information
-- - Actual content data is protected by content table RLS
-- - Actual tag data (tag names/colors) is protected by tags table RLS
-- - Write operations (INSERT/DELETE) protected by application-level checks in ContentRepository

-- Disable Row Level Security on content_tags
ALTER TABLE content_tags DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies since RLS is disabled
DROP POLICY IF EXISTS "Content tags are viewable with content" ON content_tags;
DROP POLICY IF EXISTS "Users can tag their own content" ON content_tags;
DROP POLICY IF EXISTS "Users can remove tags from their own content" ON content_tags;

-- Add comment explaining the security model
COMMENT ON TABLE content_tags IS
  'Join table for content-tag associations. RLS disabled because this is a pure mapping table with no sensitive data. Access control enforced by content and tags table RLS when joining. Write operations protected by application-level checks.';
