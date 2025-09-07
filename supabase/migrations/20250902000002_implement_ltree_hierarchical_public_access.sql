-- Implement ltree for hierarchical content structure and public access
-- This enables efficient hierarchy queries and inherited public access

-- Enable ltree extension
CREATE EXTENSION IF NOT EXISTS ltree;

-- Add ltree path column to content table
ALTER TABLE content ADD COLUMN path ltree;

-- Create indexes for efficient ltree operations
CREATE INDEX content_path_gist_idx ON content USING GIST (path);
CREATE INDEX content_path_btree_idx ON content USING BTREE (path);

-- Function to generate ltree path from content hierarchy
CREATE OR REPLACE FUNCTION generate_content_path(
  p_content_id uuid,
  p_parent_content_id uuid,
  p_group_id uuid
)
RETURNS ltree
LANGUAGE plpgsql
AS $$
DECLARE
  parent_path ltree;
  new_path ltree;
BEGIN
  -- If this is root content (no parent), path is just group_id.content_id
  IF p_parent_content_id IS NULL THEN
    new_path := (p_group_id::text || '.' || p_content_id::text)::ltree;
  ELSE
    -- Get parent's path
    SELECT path INTO parent_path 
    FROM content 
    WHERE id = p_parent_content_id;
    
    -- If parent doesn't have a path yet, generate it recursively
    IF parent_path IS NULL THEN
      -- Get parent's details to generate its path
      SELECT path INTO parent_path
      FROM content 
      WHERE id = p_parent_content_id;
      
      -- If still null, this means parent needs path generation
      IF parent_path IS NULL THEN
        RAISE EXCEPTION 'Parent content path not found. Ensure parent content has valid path.';
      END IF;
    END IF;
    
    -- Child path is parent_path + content_id
    new_path := (parent_path::text || '.' || p_content_id::text)::ltree;
  END IF;
  
  RETURN new_path;
END;
$$;

-- Function to update content path and all descendant paths
CREATE OR REPLACE FUNCTION update_content_paths()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  new_path ltree;
  old_path ltree;
BEGIN
  -- Generate new path for the updated content
  new_path := generate_content_path(NEW.id, NEW.parent_content_id, NEW.group_id);
  
  -- Store old path for descendant updates
  old_path := OLD.path;
  
  -- Update this content's path
  NEW.path := new_path;
  
  -- If path changed, update all descendant paths
  IF OLD.path IS DISTINCT FROM new_path THEN
    UPDATE content 
    SET path = (new_path::text || subpath(path, nlevel(old_path))::text)::ltree
    WHERE path <@ old_path AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to set path on content creation
CREATE OR REPLACE FUNCTION set_content_path_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate and set path for new content
  NEW.path := generate_content_path(NEW.id, NEW.parent_content_id, NEW.group_id);
  RETURN NEW;
END;
$$;

-- Create triggers for automatic path management
CREATE TRIGGER content_path_insert_trigger
  BEFORE INSERT ON content
  FOR EACH ROW
  EXECUTE FUNCTION set_content_path_on_insert();

CREATE TRIGGER content_path_update_trigger
  BEFORE UPDATE ON content
  FOR EACH ROW
  WHEN (OLD.parent_content_id IS DISTINCT FROM NEW.parent_content_id)
  EXECUTE FUNCTION update_content_paths();

-- Fix the ambiguous user_id reference in toggle_content_sharing function
DROP FUNCTION IF EXISTS toggle_content_sharing(uuid, boolean, uuid);

CREATE OR REPLACE FUNCTION toggle_content_sharing(
  content_id uuid,
  is_public boolean,
  user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_content record;
  sharing_metadata jsonb;
BEGIN
  -- Verify user owns the content - use explicit table qualifier
  IF NOT EXISTS (
    SELECT 1 FROM content 
    WHERE id = content_id AND content.user_id = toggle_content_sharing.user_id
  ) THEN
    RAISE EXCEPTION 'User does not have permission to modify this content';
  END IF;
  
  -- Build sharing metadata
  IF is_public THEN
    sharing_metadata := jsonb_build_object(
      'isPublic', true,
      'enabledAt', now(),
      'enabledBy', toggle_content_sharing.user_id
    );
  ELSE
    sharing_metadata := jsonb_build_object(
      'isPublic', false,
      'disabledAt', now(),
      'disabledBy', toggle_content_sharing.user_id
    );
  END IF;
  
  -- Update content metadata
  UPDATE content 
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('sharing', sharing_metadata)
  WHERE id = content_id
  RETURNING * INTO updated_content;
  
  -- Return success response with public URL if enabled
  IF is_public THEN
    RETURN jsonb_build_object(
      'success', true,
      'isPublic', true,
      'publicUrl', get_public_content_url(content_id)
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'isPublic', false,
      'publicUrl', null
    );
  END IF;
END;
$$;

-- Update the public content RLS policy to support hierarchical access using ltree
DROP POLICY IF EXISTS "Public content is viewable by anyone" ON content;

CREATE POLICY "Public content and descendants are viewable by anyone"
ON "public"."content"
AS PERMISSIVE FOR SELECT 
TO public
USING (
  -- Content is accessible if it OR any ancestor in its path is marked as public
  EXISTS (
    SELECT 1 FROM content ancestor 
    WHERE content.path ~ (ancestor.path::text || '.*')::lquery
    AND (ancestor.metadata->'sharing'->>'isPublic')::boolean = true
  )
);

-- Update existing content to have proper ltree paths
-- This will populate the path column for existing data
DO $$
DECLARE
  content_rec record;
BEGIN
  -- First, update all root content (no parent)
  UPDATE content 
  SET path = (group_id::text || '.' || id::text)::ltree
  WHERE parent_content_id IS NULL;
  
  -- Then iteratively update children until all have paths
  LOOP
    UPDATE content 
    SET path = (parent.path::text || '.' || content.id::text)::ltree
    FROM content parent
    WHERE content.parent_content_id = parent.id 
    AND content.path IS NULL 
    AND parent.path IS NOT NULL;
    
    -- Exit when no more updates needed
    IF NOT FOUND THEN
      EXIT;
    END IF;
  END LOOP;
END $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_content_path(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_content_sharing(uuid, boolean, uuid) TO authenticated;

-- Add helpful comment
COMMENT ON COLUMN content.path IS 'ltree path representing content hierarchy: group_id.parent_id.content_id';