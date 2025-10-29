-- Migration: Remove duplicate root relationships and fix unique constraint
--
-- Context: PostgreSQL unique indexes treat NULL as distinct (NULL != NULL),
-- which allowed duplicate root relationships: multiple (NULL, same_content_id) rows.
-- This causes content to appear multiple times in the root view.
--
-- Problem: 268 content items have duplicate root relationships (537 total vs 269 unique)
--
-- Solution:
-- 1. Delete duplicate root relationships, keeping only the oldest
-- 2. Replace broken unique index with proper partial unique indexes

-- Step 1: Delete duplicate root relationships
-- Keep the oldest relationship (lowest id) for each content item
DELETE FROM content_relationships
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY to_content_id
             ORDER BY id
           ) as rn
    FROM content_relationships
    WHERE from_content_id IS NULL
  ) sub
  WHERE rn > 1
);

-- Step 2: Drop the broken unique index
-- This index doesn't prevent NULL duplicates
DROP INDEX IF EXISTS idx_content_relationships_unique;

-- Step 3: Create proper unique constraints that handle NULLs correctly

-- For root items: only one (NULL, content_id) relationship allowed per content
-- This uses a partial unique index that only applies WHERE from_content_id IS NULL
CREATE UNIQUE INDEX idx_root_relationships_unique
  ON content_relationships (to_content_id)
  WHERE from_content_id IS NULL;

-- For child items: only one (parent_id, child_id) relationship allowed
-- This uses a partial unique index that only applies WHERE from_content_id IS NOT NULL
CREATE UNIQUE INDEX idx_child_relationships_unique
  ON content_relationships (from_content_id, to_content_id)
  WHERE from_content_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_root_relationships_unique IS
  'Ensures each content item has at most one root relationship (from_content_id IS NULL). Uses partial index to properly handle NULL values.';

COMMENT ON INDEX idx_child_relationships_unique IS
  'Ensures each parent-child relationship is unique. Uses partial index to exclude root relationships from this constraint.';
