-- Re-enable RLS on all join tables for PostgREST query planner consistency
-- This ensures PostgREST can properly construct queries with ordering on foreign key embeds

-- Re-enable RLS on content_tags
ALTER TABLE content_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view content tags"
ON content_tags
FOR SELECT
TO anon, authenticated
USING (true);

-- Re-enable RLS on tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view tags"
ON tags
FOR SELECT
TO anon, authenticated
USING (true);

-- Update content_relationships policy to include anon role
DROP POLICY IF EXISTS "Authenticated users can view all relationships" ON content_relationships;

CREATE POLICY "All users can view relationships"
ON content_relationships
FOR SELECT
TO anon, authenticated
USING (true);

-- Add comments for documentation
COMMENT ON TABLE content_tags IS 'Content tags join table - RLS enabled with permissive policy for PostgREST compatibility';
COMMENT ON TABLE tags IS 'Tags table - RLS enabled with permissive policy for PostgREST compatibility';
COMMENT ON POLICY "All users can view relationships" ON content_relationships IS 'Permissive policy. Security enforced via content table RLS.';
COMMENT ON POLICY "All users can view content tags" ON content_tags IS 'Permissive policy. Security enforced via content table RLS.';
COMMENT ON POLICY "All users can view tags" ON tags IS 'Permissive policy. Tag data not sensitive, access controlled via content RLS.';
