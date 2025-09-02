-- Fix ambiguous user_id reference in toggle_content_sharing function
-- Error: column reference "user_id" is ambiguous - could refer to function parameter or table column

-- Drop and recreate the function with explicit table qualifiers
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
      'enabledBy', toggle_content_sharing.user_id  -- Use function parameter explicitly
    );
  ELSE
    sharing_metadata := jsonb_build_object(
      'isPublic', false,
      'disabledAt', now(),
      'disabledBy', toggle_content_sharing.user_id  -- Use function parameter explicitly
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

-- Restore permissions
GRANT EXECUTE ON FUNCTION toggle_content_sharing(uuid, boolean, uuid) TO authenticated;