-- Add trigger to automatically create content_relationships when content is inserted
-- This eliminates the need for application code to manually create relationships
--
-- Behavior:
-- - If parent_content_id IS NULL → Create root relationship (from_content_id = NULL)
-- - If parent_content_id IS NOT NULL → Create child relationship (from_content_id = parent_content_id)
-- - Uses ON CONFLICT DO NOTHING for idempotency

-- Create trigger function
CREATE OR REPLACE FUNCTION create_content_relationship_for_new_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create relationship based on parent_content_id
  IF NEW.parent_content_id IS NULL THEN
    -- Root item: from_content_id = NULL indicates no parent
    INSERT INTO content_relationships (from_content_id, to_content_id, display_order)
    VALUES (NULL, NEW.id, 0)
    ON CONFLICT (from_content_id, to_content_id) DO NOTHING;
  ELSE
    -- Child item: from_content_id points to parent
    INSERT INTO content_relationships (from_content_id, to_content_id, display_order)
    VALUES (NEW.parent_content_id, NEW.id, 0)
    ON CONFLICT (from_content_id, to_content_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER content_relationship_auto_create_trigger
  AFTER INSERT ON content
  FOR EACH ROW
  EXECUTE FUNCTION create_content_relationship_for_new_content();

-- Add comments for documentation
COMMENT ON FUNCTION create_content_relationship_for_new_content() IS
  'Automatically creates a content_relationships entry when content is inserted. Creates root relationship (from_content_id = NULL) for items without parent, or child relationship (from_content_id = parent_content_id) for items with parent. Idempotent via ON CONFLICT DO NOTHING.';

COMMENT ON TRIGGER content_relationship_auto_create_trigger ON content IS
  'Automatically creates content_relationships entry for all new content inserts. Ensures all content is accessible via content_relationships table.';
