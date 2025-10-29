-- Migration: Add content_relationships join table for arbitrary content relationships
-- This replaces the denormalized parent_content_id column with a many-to-many join table
-- Migration Strategy: Dual-write period (1-2 weeks), then deprecate parent_content_id

-- Step 1: Create content_relationships table
-- from_content_id is nullable: NULL = root item, non-NULL = child of parent
CREATE TABLE IF NOT EXISTS content_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_content_id UUID REFERENCES content(id) ON DELETE CASCADE,  -- Nullable for root items
  to_content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_relationships_from
  ON content_relationships(from_content_id);

CREATE INDEX IF NOT EXISTS idx_content_relationships_to
  ON content_relationships(to_content_id);

-- Composite index for ordered child queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_content_relationships_from_order
  ON content_relationships(from_content_id, display_order);

-- Index for finding all parents of a content item
CREATE INDEX IF NOT EXISTS idx_content_relationships_to_from
  ON content_relationships(to_content_id, from_content_id);

-- Step 3: Add constraints
-- Prevent self-referencing relationships (A -> A), but allow NULL (root items)
ALTER TABLE content_relationships
  ADD CONSTRAINT no_self_reference
  CHECK (from_content_id IS NULL OR from_content_id != to_content_id);

-- Unique constraint: prevent duplicate relationships with same order
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_relationships_unique
  ON content_relationships(from_content_id, to_content_id);

-- Step 4: Migrate existing parent_content_id relationships to join table
-- This preserves the existing hierarchy in the new model

-- 4a. Create root item relationships (from_content_id = NULL for root items)
INSERT INTO content_relationships (from_content_id, to_content_id, display_order)
SELECT
  NULL,  -- Root items have no parent
  id,
  0
FROM content
WHERE parent_content_id IS NULL
ON CONFLICT (from_content_id, to_content_id) DO NOTHING;

-- 4b. Create child item relationships (from_content_id = parent for children)
INSERT INTO content_relationships (from_content_id, to_content_id, display_order)
SELECT
  parent_content_id,
  id,
  0  -- Default display order, could be enhanced with ROW_NUMBER() if needed
FROM content
WHERE parent_content_id IS NOT NULL
ON CONFLICT (from_content_id, to_content_id) DO NOTHING;

-- Step 5: Enable RLS
ALTER TABLE content_relationships ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS Policies

-- Policy: Users can view relationships if they have access to parent OR child
-- This implements "cross-group links grant implicit access" requirement
-- If you can see the parent, you can see the child (even if in different group)
CREATE POLICY "Relationships viewable if can see parent or child"
ON content_relationships FOR SELECT
USING (
  -- Can see if have access to parent content
  EXISTS (
    SELECT 1 FROM content
    WHERE content.id = content_relationships.from_content_id
    AND EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_memberships.group_id = content.group_id
      AND group_memberships.user_id::text = auth.uid()::text
    )
  )
  OR
  -- Can see if have access to child content
  EXISTS (
    SELECT 1 FROM content
    WHERE content.id = content_relationships.to_content_id
    AND EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_memberships.group_id = content.group_id
      AND group_memberships.user_id::text = auth.uid()::text
    )
  )
);

-- Policy: Users can create relationships if they have access to both parent and child
CREATE POLICY "Can create relationships for accessible content"
ON content_relationships FOR INSERT
WITH CHECK (
  -- Must have access to parent content
  EXISTS (
    SELECT 1 FROM content
    WHERE content.id = content_relationships.from_content_id
    AND EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_memberships.group_id = content.group_id
      AND group_memberships.user_id::text = auth.uid()::text
    )
  )
  AND
  -- Must have access to child content
  EXISTS (
    SELECT 1 FROM content
    WHERE content.id = content_relationships.to_content_id
    AND EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_memberships.group_id = content.group_id
      AND group_memberships.user_id::text = auth.uid()::text
    )
  )
);

-- Policy: Users can update relationships they have access to
CREATE POLICY "Can update relationships for accessible content"
ON content_relationships FOR UPDATE
USING (
  -- Must have access to both parent and child
  EXISTS (
    SELECT 1 FROM content
    WHERE content.id = content_relationships.from_content_id
    AND EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_memberships.group_id = content.group_id
      AND group_memberships.user_id::text = auth.uid()::text
    )
  )
  AND
  EXISTS (
    SELECT 1 FROM content
    WHERE content.id = content_relationships.to_content_id
    AND EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_memberships.group_id = content.group_id
      AND group_memberships.user_id::text = auth.uid()::text
    )
  )
);

-- Policy: Users can delete relationships they have access to
CREATE POLICY "Can delete relationships for accessible content"
ON content_relationships FOR DELETE
USING (
  -- Must have access to both parent and child
  EXISTS (
    SELECT 1 FROM content
    WHERE content.id = content_relationships.from_content_id
    AND EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_memberships.group_id = content.group_id
      AND group_memberships.user_id::text = auth.uid()::text
    )
  )
  AND
  EXISTS (
    SELECT 1 FROM content
    WHERE content.id = content_relationships.to_content_id
    AND EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_memberships.group_id = content.group_id
      AND group_memberships.user_id::text = auth.uid()::text
    )
  )
);

-- Step 7: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE content_relationships TO anon, authenticated;

-- Step 8: Enable realtime for content_relationships
-- This allows frontend to subscribe to relationship changes
ALTER PUBLICATION supabase_realtime ADD TABLE content_relationships;

-- Rollback instructions:
-- If needed within 1-2 weeks dual-write period:
-- DROP TABLE IF EXISTS content_relationships CASCADE;
-- Note: parent_content_id column remains intact during dual-write period
