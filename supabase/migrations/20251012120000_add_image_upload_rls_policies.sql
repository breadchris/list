-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS "Users can upload images to their content" ON storage.objects;
DROP POLICY IF EXISTS "Users can view images from their content" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete images from their content" ON storage.objects;

-- Policy: Users can upload images to content bucket with content UUID prefix
-- Path pattern: <content-uuid>/<filename>
-- Access check: user must have access to the content via group_memberships
CREATE POLICY "Users can upload images to their content"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'content'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM content c
    INNER JOIN group_memberships gm ON c.group_id = gm.group_id
    WHERE gm.user_id = auth.uid()
  )
);

-- Policy: Users can view/download images from content they have access to
CREATE POLICY "Users can view images from their content"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'content'
  AND (
    -- Allow access to public folder (existing screenshots)
    (storage.foldername(name))[1] = 'public'
    OR
    -- Allow access to screenshots folder (existing pattern)
    (storage.foldername(name))[1] = 'screenshots'
    OR
    -- Allow access to content UUID folders where user has group access
    (storage.foldername(name))[1] IN (
      SELECT c.id::text
      FROM content c
      INNER JOIN group_memberships gm ON c.group_id = gm.group_id
      WHERE gm.user_id = auth.uid()
    )
  )
);

-- Policy: Users can delete images from content they have access to
CREATE POLICY "Users can delete images from their content"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'content'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM content c
    INNER JOIN group_memberships gm ON c.group_id = gm.group_id
    WHERE gm.user_id = auth.uid()
  )
);

-- Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
