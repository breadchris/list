-- Migration: Fix missing root relationships in production
--
-- Context: The initial content_relationships migration had a broken CHECK constraint
-- that prevented inserting root relationships (from_content_id = NULL).
-- This migration creates the missing root relationships.

-- Insert root relationships for all content items that have parent_content_id = NULL
-- but don't yet have a relationship record
INSERT INTO content_relationships (from_content_id, to_content_id, display_order)
SELECT
  NULL,  -- Root items have no parent
  id,
  0
FROM content
WHERE parent_content_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM content_relationships cr
    WHERE cr.to_content_id = content.id
    AND cr.from_content_id IS NULL
  );
