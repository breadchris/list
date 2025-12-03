-- RLS policies for anonymous content uploads
-- Allow unauthenticated users to create, view, update, and delete content in the anonymous group

-- Policy: Anonymous users can create content in the anonymous uploads group
CREATE POLICY "Anonymous users can create content in anonymous group"
ON content
FOR INSERT
TO anon
WITH CHECK (
  group_id = '00000000-0000-0000-0000-000000000001'
);

-- Policy: Anonymous users can view content in the anonymous uploads group
CREATE POLICY "Anonymous users can view content in anonymous group"
ON content
FOR SELECT
TO anon
USING (
  group_id = '00000000-0000-0000-0000-000000000001'
);

-- Policy: Anonymous users can update content in the anonymous uploads group
CREATE POLICY "Anonymous users can update content in anonymous group"
ON content
FOR UPDATE
TO anon
USING (
  group_id = '00000000-0000-0000-0000-000000000001'
)
WITH CHECK (
  group_id = '00000000-0000-0000-0000-000000000001'
);

-- Policy: Anonymous users can delete content in the anonymous uploads group
CREATE POLICY "Anonymous users can delete content in anonymous group"
ON content
FOR DELETE
TO anon
USING (
  group_id = '00000000-0000-0000-0000-000000000001'
);
