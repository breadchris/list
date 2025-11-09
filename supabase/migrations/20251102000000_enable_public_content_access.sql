-- Enable public access to explicitly public content
-- This allows anonymous users to view content items marked as public via metadata.sharing.isPublic

-- Add RLS policy for anonymous (public) users to view public content
CREATE POLICY "Public content is viewable by anyone"
ON "public"."content"
AS PERMISSIVE FOR SELECT
TO public
USING ((metadata->'sharing'->>'isPublic')::boolean = true);

-- Note: This policy allows access to content items that are explicitly marked as public.
-- Children of public content must also be marked as public to be visible via this policy.
-- The content_relationships table already has a permissive SELECT policy for anonymous users.
