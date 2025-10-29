-- Drop ltree path column and all related objects
-- The ltree path column was causing PostgREST nested joins to return NULL
-- This migration removes all ltree-related infrastructure

-- Drop RLS policy that uses ltree path
DROP POLICY IF EXISTS "Public content and descendants are viewable by anyone" ON content;

-- Drop triggers
DROP TRIGGER IF EXISTS content_path_insert_trigger ON content;
DROP TRIGGER IF EXISTS content_path_update_trigger ON content;

-- Drop functions
DROP FUNCTION IF EXISTS set_content_path_on_insert();
DROP FUNCTION IF EXISTS update_content_paths();
DROP FUNCTION IF EXISTS generate_content_path(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS check_content_has_public_ancestor(ltree);

-- Drop indexes
DROP INDEX IF EXISTS content_path_gist_idx;
DROP INDEX IF EXISTS content_path_btree_idx;

-- Drop the path column
ALTER TABLE content DROP COLUMN IF EXISTS path;

-- Drop ltree extension (only if no other tables use it)
-- Uncomment if you're sure no other tables use ltree:
-- DROP EXTENSION IF EXISTS ltree;

-- Add comment for documentation
COMMENT ON TABLE content IS 'Content table - ltree path column removed to fix PostgREST nested join issues';
