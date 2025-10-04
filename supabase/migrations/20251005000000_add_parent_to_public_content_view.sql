-- Add parent_content_id to public_content view
-- This enables displaying hierarchical content structure in public views

-- Drop existing view
DROP VIEW IF EXISTS public_content;

-- Recreate view with parent_content_id included
CREATE OR REPLACE VIEW public_content AS
SELECT
  id,
  created_at,
  updated_at,
  type,
  data,
  metadata,
  parent_content_id,
  (metadata->'sharing'->>'enabledAt')::timestamptz as shared_at,
  (metadata->'sharing'->>'enabledBy')::uuid as shared_by
FROM content
WHERE (metadata->'sharing'->>'isPublic')::boolean = true;

-- Grant access to public content view
GRANT SELECT ON public_content TO anon, authenticated;

-- Add comment explaining the view
COMMENT ON VIEW public_content IS 'Publicly accessible content view that includes parent_content_id for hierarchical navigation';
