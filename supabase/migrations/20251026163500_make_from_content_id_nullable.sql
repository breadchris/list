-- Migration: Make from_content_id nullable to support root relationships
--
-- Context: The initial content_relationships migration created from_content_id as NOT NULL,
-- which prevents storing root items (items with no parent).
-- This migration alters the column to be nullable, allowing NULL to represent root items.

-- Make from_content_id nullable
ALTER TABLE content_relationships
  ALTER COLUMN from_content_id DROP NOT NULL;

-- Update the CHECK constraint to allow NULL (root items)
-- First drop the old constraint
ALTER TABLE content_relationships
  DROP CONSTRAINT IF EXISTS no_self_reference;

-- Add updated constraint that allows NULL
ALTER TABLE content_relationships
  ADD CONSTRAINT no_self_reference
  CHECK (from_content_id IS NULL OR from_content_id != to_content_id);