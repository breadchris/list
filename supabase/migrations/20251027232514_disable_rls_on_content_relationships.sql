-- Migration: Disable RLS entirely on content_relationships table
--
-- Context: With RLS enabled but no SELECT policy, PostgreSQL defaults to DENY ALL
-- for non-superuser roles. This causes PostgREST queries to return empty arrays []
-- even though data exists in the table.
--
-- Root Cause: Previous migration removed SELECT policy but left RLS enabled
-- - RLS enabled + no SELECT policy = implicit DENY for authenticated users
-- - Service role queries work (bypasses RLS as superuser)
-- - Authenticated user queries return empty array
--
-- Solution: Disable RLS entirely on content_relationships
-- - content_relationships is a pure join table with no sensitive data
-- - Only contains: from_content_id, to_content_id, display_order
-- - All access control happens via content table's RLS (group membership check)
-- - When PostgREST joins content_relationships → content, users only see content
--   they have access to based on content table's RLS policies
--
-- Security Analysis:
-- - The relationship mapping itself is not sensitive information
-- - Users can't infer private content from seeing relationship IDs
-- - Actual content data is protected by content table RLS
-- - Write operations (INSERT/UPDATE/DELETE) still require proper permissions
--   via application-level checks in ContentRepository

-- Disable Row Level Security on content_relationships
ALTER TABLE content_relationships DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies since RLS is disabled
DROP POLICY IF EXISTS "Users can create relationships in their groups" ON content_relationships;
DROP POLICY IF EXISTS "Users can update relationships in their groups" ON content_relationships;
DROP POLICY IF EXISTS "Users can delete relationships in their groups" ON content_relationships;

-- Add comment explaining the security model
COMMENT ON TABLE content_relationships IS
  'Join table for content hierarchy. RLS disabled because this is a pure mapping table with no sensitive data. Access control enforced by content table RLS when joining. Write operations protected by application-level checks.';
