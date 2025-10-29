-- Fix unique index on content_relationships to handle NULL values in ON CONFLICT
--
-- Problem: The existing unique index treats NULLs as distinct from each other
-- This causes ON CONFLICT (from_content_id, to_content_id) to fail when
-- from_content_id is NULL because PostgreSQL cannot match NULL values.
--
-- Error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Solution: Recreate the index with NULLS NOT DISTINCT (PostgreSQL 15+)
-- This treats NULL as equal to NULL for uniqueness purposes, allowing:
-- 1. Only one root relationship per content item (NULL, content_id)
-- 2. ON CONFLICT to work properly with NULL values in the trigger

-- Drop the existing unique index
DROP INDEX IF EXISTS idx_content_relationships_unique;

-- Recreate with NULLS NOT DISTINCT
-- This makes NULL = NULL for uniqueness, preventing duplicate root relationships
-- and allowing ON CONFLICT to match NULL values
CREATE UNIQUE INDEX idx_content_relationships_unique
  ON content_relationships(from_content_id, to_content_id)
  NULLS NOT DISTINCT;

-- Add comment explaining the NULL handling
COMMENT ON INDEX idx_content_relationships_unique IS
  'Unique constraint on (from_content_id, to_content_id) with NULLS NOT DISTINCT. This prevents duplicate root relationships (NULL, content_id) and allows ON CONFLICT to work with NULL values in triggers and application code.';
