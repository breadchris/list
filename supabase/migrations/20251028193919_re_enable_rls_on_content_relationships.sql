-- Re-enable RLS on content_relationships to fix PostgREST ordering issue
-- PostgREST cannot order by foreign key columns when RLS is disabled on join tables
-- This migration re-enables RLS with a permissive policy to fix query planning

-- Re-enable RLS on content_relationships
ALTER TABLE content_relationships ENABLE ROW LEVEL SECURITY;

-- Create permissive policy that allows all authenticated users to view relationships
-- Security is enforced at the content table level, so this is safe
CREATE POLICY "Authenticated users can view all relationships"
ON content_relationships
FOR SELECT
TO authenticated
USING (true);

-- Add comment for documentation
COMMENT ON TABLE content_relationships IS 'Content relationships - RLS enabled to support PostgREST ordering on foreign key joins. Security enforced via content table RLS.';
