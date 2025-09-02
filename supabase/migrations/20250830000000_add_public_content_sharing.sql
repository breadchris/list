-- Add public content sharing functionality
-- This migration enables content to be shared publicly with anonymous users

-- Create index for efficient public content queries
CREATE INDEX "idx_content_public_sharing" ON "public"."content" 
USING gin((metadata->'sharing')) 
WHERE (metadata->>'sharing')::jsonb->>'isPublic' = 'true';

-- Create policy to allow anonymous users to view public content
CREATE POLICY "Public content is viewable by anyone"
ON "public"."content"
AS PERMISSIVE FOR SELECT 
TO public
USING (
  -- Content is public if metadata.sharing.isPublic is true
  (metadata->'sharing'->>'isPublic')::boolean = true
);

-- Create function to get public content URL
CREATE OR REPLACE FUNCTION get_public_content_url(content_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_url text := 'https://your-domain.com'; -- Update this with actual domain
BEGIN
  RETURN base_url || '/public/content/' || content_id::text;
END;
$$;

-- Create function to toggle content public sharing
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
  -- Verify user owns the content
  IF NOT EXISTS (
    SELECT 1 FROM content 
    WHERE id = content_id AND user_id = toggle_content_sharing.user_id
  ) THEN
    RAISE EXCEPTION 'User does not have permission to modify this content';
  END IF;
  
  -- Build sharing metadata
  IF is_public THEN
    sharing_metadata := jsonb_build_object(
      'isPublic', true,
      'enabledAt', now(),
      'enabledBy', user_id
    );
  ELSE
    sharing_metadata := jsonb_build_object(
      'isPublic', false,
      'disabledAt', now(),
      'disabledBy', user_id
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_public_content_url(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION toggle_content_sharing(uuid, boolean, uuid) TO authenticated;

-- Create view for public content with basic metadata
CREATE OR REPLACE VIEW public_content AS
SELECT 
  id,
  created_at,
  updated_at,
  type,
  data,
  metadata,
  (metadata->'sharing'->>'enabledAt')::timestamptz as shared_at,
  (metadata->'sharing'->>'enabledBy')::uuid as shared_by
FROM content
WHERE (metadata->'sharing'->>'isPublic')::boolean = true;

-- Grant access to public content view
GRANT SELECT ON public_content TO anon, authenticated;

-- Add comment to document the sharing metadata structure
COMMENT ON COLUMN content.metadata IS 'JSONB field containing SEO and sharing metadata. Sharing structure: {"sharing": {"isPublic": boolean, "enabledAt": timestamp, "enabledBy": uuid}}';